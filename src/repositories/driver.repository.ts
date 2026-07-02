import mongoose from "mongoose";
import { OrderModel } from "../models/order.model";
import { UserModel } from "../models/user.model";

export class DriverRepository {
  async updateDriverStatus(driverId: string, status: "active" | "inactive") {
    return UserModel.findByIdAndUpdate(driverId, { status }, { new: true });
  }
  async findDriverById(driverId: string) {
    return UserModel.findById(driverId);
  }
  async findOrderById(orderId: string) {
    return OrderModel.findById(orderId);
  }

  async assignDriverToOrder(orderId: string, driverId: string) {
    return OrderModel.findByIdAndUpdate(
      orderId,
      {
        driverId: new mongoose.Types.ObjectId(driverId),
        status: "shipped",
      },
      { new: true },
    );
  }

  async updateOrderStatus(orderId: string, status: "shipped" | "delivered") {
    return OrderModel.findByIdAndUpdate(orderId, { status }, { new: true });
  }

  async getDrivers(params?: { search?: string }) {
    const q = params?.search?.trim();

    const match: any = { role: "driver" };

    if (q) {
      match.$or = [
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phoneNumber: { $regex: q, $options: "i" } },
      ];
    }

    return UserModel.aggregate([
      { $match: match },

      // join driver profile
      {
        $lookup: {
          from: "driverprofiles",
          localField: "_id",
          foreignField: "userId",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          username: 1,
          email: 1,
          phoneNumber: 1,
          status: 1,
          location: 1,
        },
      },
    ]);
  }

  // stats for all drivers (single query)
  async getDriversStats() {
    const stats = await OrderModel.aggregate([
      { $match: { driverId: { $ne: null } } },
      {
        $group: {
          _id: "$driverId",
          totalAssigned: { $sum: 1 },
          deliveredCount: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
        },
      },
    ]);

    const map: Record<
      string,
      { totalAssigned: number; deliveredCount: number }
    > = {};
    for (const s of stats) {
      map[String(s._id)] = {
        totalAssigned: s.totalAssigned,
        deliveredCount: s.deliveredCount,
      };
    }
    return map;
  }

  // ✅ stats for ONE driver
  async getDriverStatsById(driverId: string) {
    const [row] = await OrderModel.aggregate([
      { $match: { driverId: new mongoose.Types.ObjectId(driverId) } },
      {
        $group: {
          _id: "$driverId",
          totalAssigned: { $sum: 1 },
          deliveredCount: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
        },
      },
    ]);

    return {
      totalAssigned: row?.totalAssigned ?? 0,
      deliveredCount: row?.deliveredCount ?? 0,
    };
  }

  async findOrdersByDriverIdPaginated(driverId: string, page = 1, size = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(size) || 10));
    const skip = (safePage - 1) * safeSize;

    const filter = { driverId: new mongoose.Types.ObjectId(driverId) };

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeSize),
      OrderModel.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: {
        page: safePage,
        size: safeSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeSize)),
      },
    };
  }
}
