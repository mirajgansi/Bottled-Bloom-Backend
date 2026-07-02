import {
  CreateNotificationDTO,
  ListNotificationsQueryDTO,
  MarkAsReadDTO,
} from "../dtos/notificatoin.dto";
import { NotificationRepository } from "../repositories/notification.repository";
import { getIO, isUserOnline } from "../config/socket"; // adjust path
import { UserRepository } from "../repositories/user.repository";
import { sendPushNotification } from "../utils/sendNotification";

export class NotificationService {
  constructor(private repo = new NotificationRepository()) {}

  listForUser(userId: string, query: ListNotificationsQueryDTO) {
    return this.repo.findByUser(userId, {
      page: query.page,
      limit: query.limit,
      read: query.read,
    });
  }

  async notify(data: CreateNotificationDTO) {
    const saved = await this.repo.create(data);

    const userId = saved.to.toString();

    const io = getIO();
    io.to(userId).emit("notification", saved);

    const userRepo = new UserRepository();
    const user = await userRepo.getUserById(userId);
    const token = user?.fcmToken;

    if (!isUserOnline(userId) && token) {
      await sendPushNotification(token, saved.title, saved.message, {
        type: saved.type ?? "notification",
        notificationId: saved._id.toString(),
      });
    }

    return saved;
  }

  async markRead(userId: string, dto: MarkAsReadDTO) {
    const updated = await this.repo.markRead(dto.notificationId, userId);
    if (!updated) throw new Error("Notification not found");
    return updated;
  }

  markAllRead(userId: string) {
    return this.repo.markAllRead(userId);
  }

  unreadCount(userId: string) {
    return this.repo.unreadCount(userId);
  }
}
