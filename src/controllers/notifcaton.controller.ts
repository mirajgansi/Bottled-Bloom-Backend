import { Request, Response } from "express";
import {
  createNotificationDto,
  listNotificationsQueryDto,
  markAsReadDto,
} from "../dtos/notificatoin.dto";
import { NotificationService } from "../services/notification.service";

const service = new NotificationService();

export class NotificationController {
  async create(req: Request, res: Response) {
    const dto = createNotificationDto.parse(req.body);
    const notif = await service.notify(dto);
    res.status(201).json({ success: true, data: notif });
  }

  async myNotifications(req: any, res: Response) {
    const query = listNotificationsQueryDto.parse(req.query);
    const data = await service.listForUser(req.user.id, query);
    res.json({ success: true, ...data });
  }

  async markRead(req: any, res: Response) {
    const dto = markAsReadDto.parse({ notificationId: req.params.id });
    const data = await service.markRead(req.user.id, dto);
    res.json({ success: true, data });
  }

  async markAllRead(req: any, res: Response) {
    const data = await service.markAllRead(req.user.id);
    res.json({ success: true, data });
  }

  async unreadCount(req: any, res: Response) {
    const count = await service.unreadCount(req.user.id);
    res.json({ success: true, count });
  }
}
