import { Router } from "express";
import { NotificationController } from "../controllers/notifcaton.controller";
import {
  authorizedMiddleware,
  adminMiddleware,
} from "../middleware/authorized.middleware";

const router = Router();
const controller = new NotificationController();

router.use(authorizedMiddleware);

router.get("/me", controller.myNotifications.bind(controller));
router.get("/me/unread-count", controller.unreadCount.bind(controller));
router.patch("/me/read-all", controller.markAllRead.bind(controller));
router.patch("/:id/read", controller.markRead.bind(controller));

router.post("/", adminMiddleware, controller.create.bind(controller));

export default router;
