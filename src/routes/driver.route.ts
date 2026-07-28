import { Router } from "express";
import { DriverController } from "../controllers/driver.controller";
import {
  adminMiddleware,
  driverMiddleware,
} from "../middleware/authorized.middleware";
import { authorizedMiddleware } from "../middleware/authorized.middleware";

const router = Router();
const controller = new DriverController();
router.use(authorizedMiddleware);
router.patch(
  "/:id/status",
  driverMiddleware,
  controller.driverUpdateStatus.bind(controller),
);
router.patch(
  "/orders/:id/status",
  driverMiddleware,
  controller.driverUpdateOrderStatus.bind(controller),
);

router.get(
  "/stats/:id",
  authorizedMiddleware,
  controller.getDriverStatsById.bind(controller),
);
router.get(
  "/:id/detail",
  authorizedMiddleware,
  controller.getDriverDetailById.bind(controller),
);

router.get("/stats", controller.getDriversByStats.bind(controller));

export default router;
