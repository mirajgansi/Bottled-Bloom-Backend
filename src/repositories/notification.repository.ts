import { Types } from "mongoose";
import { CreateNotificationDTO } from "../dtos/notificatoin.dto";
import { NotificationModel } from "../models/notification.model";

export class NotificationRepository {
  async create(data: CreateNotificationDTO) {
    return NotificationModel.create({
      ...data,
      to: new Types.ObjectId(data.to),
      from: data.from ? new Types.ObjectId(data.from) : undefined,
    });
  }

  async findByUser(
    userId: string,
    opts: { page: number; limit: number; read?: boolean },
  ) {
    const filter: { to: Types.ObjectId; read?: boolean } = {
      to: new Types.ObjectId(userId),
    };

    if (opts.read !== undefined) filter.read = opts.read;

    const skip = (opts.page - 1) * opts.limit;

    const [items, total] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(opts.limit),
      NotificationModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: opts.page,
      limit: opts.limit,
      totalPages: Math.ceil(total / opts.limit),
    };
  }

  async markRead(notificationId: string, userId: string) {
    return NotificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        to: new Types.ObjectId(userId), // ✅ changed
      },
      { $set: { read: true } },
      { new: true },
    );
  }

  async markAllRead(userId: string) {
    const res = await NotificationModel.updateMany(
      { to: new Types.ObjectId(userId), read: false }, // ✅ changed
      { $set: { read: true } },
    );
    return { modified: res.modifiedCount };
  }

  async unreadCount(userId: string) {
    return NotificationModel.countDocuments({
      to: new Types.ObjectId(userId), // ✅ changed
      read: false,
    });
  }
}
export class NotificationService {
  async notify(dto: CreateNotificationDTO) {
    return NotificationModel.create(dto);
  }
}
