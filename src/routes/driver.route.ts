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
// driver updates availability
router.patch(
  "/:id/status",
  driverMiddleware,
  controller.driverUpdateStatus.bind(controller),
);

// driver updates order status
router.patch(
  "/orders/:id/status",
  driverMiddleware,
  controller.driverUpdateOrderStatus.bind(controller),
);

router.get(
  "/stats/:id",
  // authMiddleware,
  // adminMiddleware,
  controller.getDriverStatsById.bind(controller),
);
router.get("/:id/detail", controller.getDriverDetailById.bind(controller));

router.get(
  "/stats",
  // adminMiddleware, // enable if needed
  controller.getDriversByStats.bind(controller),
);

export default router;
