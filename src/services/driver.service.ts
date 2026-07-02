import mongoose from "mongoose";
import { DriverRepository } from "../repositories/driver.repository";
import { HttpError } from "../errors/http-error";
import { OrderModel } from "../models/order.model";
import { ProductModel } from "../models/product.model";
import { NotificationService } from "./notification.service";

type DriverStatus = "shipped" | "delivered";
const notificationService = new NotificationService();

export class DriverService {
  constructor(private repo = new DriverRepository()) {}

  async driverUpdateStatus(
    driverId: string,
    orderId: string,
    status: DriverStatus,
  ) {
    if (!driverId) throw new HttpError(401, "Unauthorized");
    if (!mongoose.Types.ObjectId.isValid(orderId))
      throw new HttpError(400, "Invalid order id");

    const session = await mongoose.startSession();

    try {
      const updated = await session.withTransaction(async () => {
        const order = await OrderModel.findById(orderId).session(session);
        if (!order) throw new HttpError(404, "Order not found");

        if (!order.driverId || String(order.driverId) !== String(driverId)) {
          throw new HttpError(403, "This order is not assigned to you");
        }

        const allowed: DriverStatus[] = ["shipped", "delivered"];
        if (!allowed.includes(status)) {
          throw new HttpError(
            400,
            "Driver can only set status to shipped or delivered",
          );
        }

        if (order.status === "cancelled" || order.status === "delivered") {
          throw new HttpError(
            400,
            `Cannot update order when status is ${order.status}`,
          );
        }

        if (status === "delivered" && order.status !== "shipped") {
          throw new HttpError(400, "Order must be shipped before delivered");
        }

        order.status = status;

        if (status === "delivered") {
          order.paymentStatus = "paid";

          for (const it of order.items as any[]) {
            await ProductModel.updateOne(
              { _id: it.productId },
              { $inc: { totalSold: it.quantity, totalRevenue: it.lineTotal } },
              { session },
            );
          }
        }

        await order.save({ session });
        return order;
      });

      const orderIdStr = updated._id.toString();

      await notificationService.notify({
        to: updated.userId.toString(),
        type: status === "delivered" ? "order_delivered" : "order_shipped",
        title: status === "delivered" ? "Order Delivered" : "Order Shipped",
        message:
          status === "delivered"
            ? "Your order has been delivered."
            : "Your order has been shipped.",
        data: {
          orderId: orderIdStr,
        },
      });

      return updated;
    } finally {
      session.endSession();
    }
  }

  async driverUpdateOrderStatus(
    orderId: string,
    status: "shipped" | "delivered",
  ) {
    if (!mongoose.Types.ObjectId.isValid(orderId))
      return { success: false, message: "Invalid order id" };

    const order = await this.repo.findOrderById(orderId);
    if (!order) return { success: false, message: "Order not found" };

    if (order.status === "cancelled")
      return { success: false, message: "Cannot update a cancelled order" };
    if (order.status === "delivered")
      return { success: false, message: "Order already delivered" };

    const updated = await this.repo.updateOrderStatus(orderId, status);
    if (!updated) return { success: false, message: "Order not found" };

    const orderIdStr = updated._id.toString();
    const userIdStr = updated.userId.toString();
    const driverIdStr = updated.driverId?.toString(); // might be undefined

    if (status === "shipped") {
      // notify user
      await notificationService.notify({
        to: userIdStr,
        type: "order_shipped",
        title: "Order Shipped",
        message: "Your order has been shipped.",
        data: { orderId: orderIdStr },
      });

      // notify driver (optional)
      if (driverIdStr) {
        await notificationService.notify({
          to: driverIdStr,
          type: "order_shipped",
          title: "Marked as Shipped",
          message: "You marked the order as shipped.",
          data: { orderId: orderIdStr },
        });
      }
    }

    if (status === "delivered") {
      // notify user
      await notificationService.notify({
        to: userIdStr,
        type: "order_delivered",
        title: "Order Delivered",
        message: "Your order has been delivered.",
        data: { orderId: orderIdStr },
      });

      // notify driver (optional)
      if (driverIdStr) {
        await notificationService.notify({
          to: driverIdStr,
          type: "order_delivered",
          title: "Delivered",
          message: "You marked the order as delivered.",
          data: { orderId: orderIdStr },
        });
      }
    }

    return { success: true, message: "Order updated", data: updated };
  }

  async getDriversWithStats(params?: { search?: string }) {
    const drivers = await this.repo.getDrivers(params);
    const statsMap = await this.repo.getDriversStats();

    const enriched = drivers.map((d: any) => ({
      ...d,
      totalAssigned: statsMap?.[String(d._id)]?.totalAssigned ?? 0,
      deliveredCount: statsMap?.[String(d._id)]?.deliveredCount ?? 0,
    }));

    return { success: true, data: enriched };
  }

  async getDriverStatsById(driverId: string) {
    if (!mongoose.Types.ObjectId.isValid(driverId))
      return { success: false, message: "Invalid driver id" };

    const stats = await this.repo.getDriverStatsById(driverId);
    return { success: true, data: stats };
  }

  async getDriverDetailById(driverId: string, page = 1, size = 10) {
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return { success: false, message: "Invalid driver id" };
    }

    const driver = await this.repo.findDriverById(driverId);
    if (!driver) return { success: false, message: "Driver not found" };

    const stats = await this.repo.getDriverStatsById(driverId);

    const { orders, pagination } =
      await this.repo.findOrdersByDriverIdPaginated(driverId, page, size);

    return {
      success: true,
      data: {
        driver,
        stats,
        orders,
        pagination,
      },
    };
  }
}
