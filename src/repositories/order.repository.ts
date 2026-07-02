import mongoose, { Types } from "mongoose";
import { OrderModel } from "../models/order.model";

export class OrderRepository {
  async create(payload: any, session?: any) {
    return OrderModel.create([payload], session ? { session } : undefined).then(
      (r) => r[0],
    );
  }

  async findByUserIdPaginated(userId: string, page = 1, size = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(size) || 10));
    const skip = (safePage - 1) * safeSize;

    const filter = { userId: new Types.ObjectId(userId) };

    const [data, total] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeSize),
      OrderModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        page: safePage,
        size: safeSize,
        total,
        totalPages: Math.ceil(total / safeSize),
      },
    };
  }
  async findById(orderId: string) {
    return OrderModel.findById(orderId);
  }

  async findAll({
    page,
    size,
    search,
    tab,
  }: {
    page: number;
    size: number;
    search?: string;
    tab?: string;
  }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(size) || 10));
    const skip = (safePage - 1) * safeSize;

    const filter: any = {};
    const t = (tab ?? "all").toLowerCase().trim();
    const q = (search ?? "").trim();

    // search
    if (q) {
      filter.$or = [
        { "shippingAddress.userName": { $regex: q, $options: "i" } },
        { "shippingAddress.phone": { $regex: q, $options: "i" } },
        { "shippingAddress.city": { $regex: q, $options: "i" } },
      ];
    }

    // tabs
    switch (t) {
      case "unpaid":
        filter.paymentStatus = "unpaid";
        break;

      case "paid":
        filter.paymentStatus = "paid";
        break;

      case "pending":
      case "shipped":
      case "delivered":
      case "cancelled":
        filter.status = t; // matches your enum values exactly
        break;

      case "open":
        filter.status = { $nin: ["delivered", "cancelled"] };
        break;

      case "closed":
        filter.status = { $in: ["delivered", "cancelled"] };
        break;

      case "all":
      default:
        break;
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeSize),
      OrderModel.countDocuments(filter),
    ]);

    return { orders, total };
  }

  async updateStatus(
    orderId: string,
    update: { status: string; paymentStatus?: string },
  ) {
    return OrderModel.findByIdAndUpdate(orderId, update, { new: true });
  }

  async assignDriver(orderId: string, driverId: string) {
    const updated = await OrderModel.findByIdAndUpdate(
      orderId,
      {
        driverId,
        assignedAt: new Date(),
        status: "shipped",
      },
      { new: true },
    );

    return updated;
  }

  async findAssignedToDriver(driverId: string, page = 1, size = 10) {
    const skip = (page - 1) * size;

    const [orders, total] = await Promise.all([
      OrderModel.find({ driverId: new mongoose.Types.ObjectId(driverId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size),
      OrderModel.countDocuments({
        driverId: new mongoose.Types.ObjectId(driverId),
      }),
    ]);

    return {
      orders,
      total,
    };
  }

  async driverUpdateStatus(orderId: string, status: "shipped" | "delivered") {
    const update: any = { status };

    if (status === "delivered") {
      update.paymentStatus = "paid";
      update.deliveredAt = new Date();
    }

    const updated = await OrderModel.findByIdAndUpdate(orderId, update, {
      new: true,
    });
    return updated;
  }
}
