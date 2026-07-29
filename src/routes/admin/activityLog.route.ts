import { Router } from "express";
import { ActivityLogController } from "../../controllers/admin/activityLog.controller";
import {
  authorizedMiddleware,
  adminMiddleware,
} from "../../middleware/authorized.middleware";

const router = Router();
const controller = new ActivityLogController();

router.use(authorizedMiddleware, adminMiddleware);
router.get("/", controller.list.bind(controller));

export default router;
