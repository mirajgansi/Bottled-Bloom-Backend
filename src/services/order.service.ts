import mongoose, { Types } from "mongoose";
import { OrderModel } from "../models/order.model";
import { CartModel } from "../models/cart.model";
import { ProductModel } from "../models/product.model";
import { CreateOrderDto } from "../dtos/order.dto";
import { HttpError } from "../errors/http-error";
import { OrderRepository } from "../repositories/order.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserModel } from "../models/user.model";
import { NotificationService } from "./notification.service";

type CreateOrderInput = {
  shippingFee?: number;
  shippingAddress?: any;
  notes?: string;
};
type DriverStatus = "shipped" | "delivered";

const orderRepository = new OrderRepository();
const notificationService = new NotificationService();

export class OrderService {
  async createFromCart(userId: string, input: CreateOrderInput) {
    if (!userId) throw new HttpError(401, "Unauthorized");

    const parsed = CreateOrderDto.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid input");
    }

    const session = await mongoose.startSession();

    try {
      const result = await session.withTransaction(async () => {
        // 1) Load cart + populate products
        const cart = await CartModel.findOne({ userId })
          .populate("items.productId")
          .session(session);

        if (!cart || !cart.items?.length) {
          throw new HttpError(400, "Cart is empty");
        }

        // 2) Build snapshot items + update product metrics
        const orderItems = [];

        for (const it of cart.items as any[]) {
          const p = it.productId; // populated Product doc
          if (!p) throw new HttpError(400, "Product not found in cart");

          const qty = Number(it.quantity) || 1;

          //  Stock check
          if ((p.inStock ?? 0) < qty) {
            throw new HttpError(400, `Not enough stock for ${p.name}`);
          }

          const price = Number(p.price) || 0;
          const lineTotal = price * qty;

          //  Snapshot item
          orderItems.push({
            productId: p._id,
            name: p.name,
            price,
            image: p.image,
            quantity: qty,
            lineTotal,
          });

          // Update product fields (stock + analytics)
          // IMPORTANT: update in DB using $inc to be safe
          const updateRes = await ProductModel.updateOne(
            { _id: p._id, inStock: { $gte: qty } }, // guard again
            {
              $inc: {
                inStock: -qty,
              },
            },
            { session },
          );

          if (updateRes.modifiedCount !== 1) {
            throw new HttpError(400, `Stock update failed for ${p.name}`);
          }
        }

        const productIds = orderItems.map((x: any) => x.productId);

        // 4) Totals
        const subtotal = orderItems.reduce(
          (s: number, it: any) => s + it.lineTotal,
          0,
        );
        const shippingFee = Number(parsed.data.shippingFee ?? 0);
        const total = subtotal + shippingFee;

        // 5) Create order
        const [order] = await OrderModel.create(
          [
            {
              userId: new Types.ObjectId(userId),
              items: orderItems,
              subtotal,
              shippingFee,
              total,
              status: "pending",
              paymentStatus: "unpaid",
              shippingAddress: parsed.data.shippingAddress,
              notes: parsed.data.notes,
            },
          ],
          { session },
        );

        // 6) Clear cart
        await CartModel.updateOne(
          { userId },
          { $set: { items: [] } },
          { session },
        );
        return order;
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  async getMyOrders(userId: string) {
    if (!userId) throw new HttpError(401, "Unauthorized");
    return OrderModel.find({ userId }).sort({ createdAt: -1 });
  }

  async getOrderById(orderId: string) {
    if (!orderId) throw new HttpError(400, "Order id is required");
    const order = await OrderModel.findById(orderId);
    if (!order) throw new HttpError(404, "Order not found");
    return order;
  }

  // Admin
  async getAllOrders({
    page,
    size,
    search,
    tab,
  }: {
    page?: string;
    size?: string;
    search?: string;
    tab?: string;
  }) {
    const currentPage = page ? parseInt(page) : 1;
    const pageSize = size === "all" ? 1000000 : size ? parseInt(size) : 10;

    const currentSearch = search || "";

    const { orders, total } = await orderRepository.findAll({
      page: currentPage,
      size: pageSize,
      search: currentSearch,
      tab: tab || "all",
    });

    return {
      orders,
      pagination: {
        page: currentPage,
        size: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async updateStatus(
    orderId: string,
    payload: {
      status: string;
      paymentStatus?: string;
      driverId?: string | null;
    },
  ) {
    if (!orderId) throw new HttpError(400, "Order id is required");

    const order = await OrderModel.findById(orderId);
    if (!order) throw new HttpError(404, "Order not found");

    if (payload.status === "shipped" && !payload.driverId && !order.driverId) {
      throw new HttpError(400, "Driver must be assigned before shipping");
    }

    // validate driver if provided
    let driverObjectId: any = undefined;
    if (payload.driverId) {
      if (!mongoose.Types.ObjectId.isValid(payload.driverId)) {
        throw new HttpError(400, "Invalid driverId");
      }

      const driver = await UserModel.findById(payload.driverId);
      if (!driver) throw new HttpError(404, "Driver not found");
      if (driver.role !== "driver")
        throw new HttpError(400, "Selected user is not a driver");

      driverObjectId = driver._id;
    }

    const update: any = { status: payload.status };
    if (payload.paymentStatus) update.paymentStatus = payload.paymentStatus;

    if (payload.driverId === null) update.driverId = null;
    else if (driverObjectId) update.driverId = driverObjectId;

    if (payload.status === "cancelled") update.driverId = null;

    const updated = await OrderModel.findByIdAndUpdate(orderId, update, {
      new: true,
    });
    if (!updated) throw new HttpError(404, "Order not found");

    // ---------------------------
    // Notifications section
    // ---------------------------

    const orderUrlUser = `/orders/${updated._id}`;
    const orderUrlDriver = `/driver/orders/${updated._id}`;

    if (payload.driverId && updated.driverId) {
      await notificationService.notify({
        to: updated.driverId.toString(),
        type: "driver_assigned",
        title: "New Order Assigned",
        message: "You have been assigned an order.",
        data: { orderId: updated._id.toString(), url: orderUrlDriver },
      });

      await notificationService.notify({
        to: updated.userId.toString(),
        type: "driver_assigned",
        title: "Driver Assigned",
        message: "A driver has been assigned to your order.",
        data: { orderId: updated._id.toString(), url: orderUrlUser },
      });
    }

    // 2) Status based notifications (to user + driver if exists)
    if (payload.status === "shipped") {
      // user
      await notificationService.notify({
        to: updated.userId.toString(),
        type: "order_shipped",
        title: "Order Shipped",
        message: "Your order has been shipped.",
        data: { orderId: updated._id.toString(), url: orderUrlUser },
      });

      // driver (if assigned)
      if (updated.driverId) {
        await notificationService.notify({
          to: updated.driverId.toString(),
          type: "order_shipped",
          title: "Order Shipped",
          message: "Order status is now shipped.",
          data: { orderId: updated._id.toString(), url: orderUrlDriver },
        });
      }
    }

    if (payload.status === "delivered") {
      // user
      await notificationService.notify({
        to: updated.userId.toString(),
        type: "order_delivered",
        title: "Order Delivered",
        message: "Your order has been delivered.",
        data: { orderId: updated._id.toString(), url: orderUrlUser },
      });

      // driver
      if (updated.driverId) {
        await notificationService.notify({
          to: updated.driverId.toString(),
          type: "order_delivered",
          title: "Delivered ",
          message: "You marked the order as delivered.",
          data: { orderId: updated._id.toString(), url: orderUrlDriver },
        });
      }
    }

    return updated;
  }

  async cancelMyOrder(orderId: string, userId: string) {
    if (!orderId) throw new HttpError(400, "Order id is required");
    if (!userId) throw new HttpError(401, "Unauthorized");

    const order = await OrderModel.findById(orderId);
    if (!order) throw new HttpError(404, "Order not found");

    // must be the owner
    if (String(order.userId) !== String(userId)) {
      throw new HttpError(403, "You cannot cancel this order");
    }

    // only pending can be cancelled
    if (order.status !== "pending") {
      throw new HttpError(
        400,
        "Order cannot be cancelled after status changes",
      );
    }
    for (const it of order.items as any[]) {
      await ProductModel.updateOne(
        { _id: it.productId },
        { $inc: { inStock: it.quantity } },
      );
    }
    order.status = "cancelled";
    await order.save();

    return order;
  }

  async assignDriver(orderId: string, driverId: string, userId: string) {
    if (!userId) throw new HttpError(401, "Unauthorized");

    if (!mongoose.Types.ObjectId.isValid(orderId))
      throw new HttpError(400, "Invalid order id");
    if (!mongoose.Types.ObjectId.isValid(driverId))
      throw new HttpError(400, "Invalid driverId");

    const order = await OrderModel.findById(orderId);
    if (!order) throw new HttpError(404, "Order not found");

    if (order.status === "cancelled" || order.status === "delivered") {
      throw new HttpError(
        400,
        `Cannot assign driver when order is ${order.status}`,
      );
    }

    const driver = await UserModel.findById(driverId);
    if (!driver) throw new HttpError(404, "Driver not found");
    if (driver.role !== "driver")
      throw new HttpError(400, "Selected user is not a driver");
    order.status = "shipped";
    await order.save();
    order.driverId = driver._id;

    await order.save();

    await notificationService.notify({
      to: driverId,
      from: userId,
      type: "driver_assigned",
      title: "New Order Assigned",
      message: "You have been assigned an order.",
      data: {
        orderId: order._id.toString(),
        url: `/driver/orders/${order._id}`,
      },
      role: "admin",
    });

    await notificationService.notify({
      to: order.userId.toString(),
      from: userId,
      type: "driver_assigned",
      title: "Driver Assigned",
      message: "A driver has been assigned to your order.",
      data: {
        orderId: order._id.toString(),
        url: `/orders/${order._id}`,
      },
      role: "admin",
    });

    return order;
  }

  //driver assing orders
  async getMyAssignedOrders(driverId: string, page = 1, size = 10) {
    if (!driverId) throw new HttpError(401, "Unauthorized");

    const { orders, total } = await orderRepository.findAssignedToDriver(
      driverId,
      page,
      size,
    );

    return {
      orders,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    };
  }
  async driverUpdateStatus(
    driverId: string,
    orderId: string,
    status: DriverStatus,
  ) {
    if (!driverId) throw new HttpError(401, "Unauthorized");

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new HttpError(400, "Invalid order id");
    }

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
      const userIdStr = updated.userId.toString();

      const urlByRole = {
        user: `/user/orders/${orderIdStr}`, // change if your user route differs
        driver: `/driver/orders/${orderIdStr}`,
        admin: `/admin/orders/${orderIdStr}`,
      };

      if (status === "shipped") {
        await notificationService.notify({
          to: userIdStr,
          type: "order_shipped",
          title: "Order Shipped",
          message: "Your order has been shipped.",
          data: { orderId: orderIdStr },
        });
      }

      if (status === "delivered") {
        await notificationService.notify({
          to: userIdStr,
          type: "order_delivered",
          title: "Order Delivered",
          message: "Your order has been delivered.",
          data: { orderId: orderIdStr },
        });
      }

      return updated;
    } finally {
      session.endSession();
    }
  }
}
