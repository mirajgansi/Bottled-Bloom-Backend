import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import {
  authorizedMiddleware,
  adminMiddleware,
  driverMiddleware,
} from "../middleware/authorized.middleware";

const router = Router();
const controller = new OrderController();

router.use(authorizedMiddleware);

router.post("/", controller.createFromCart.bind(controller));
router.get("/me", controller.getMyOrders.bind(controller));

// admin
router.get("/", adminMiddleware, controller.getAllOrders.bind(controller));
router.patch(
  "/:id/status",
  adminMiddleware,
  controller.updateStatus.bind(controller),
);
// // driver get assigned orders
router.get(
  "/driver/my-orders",
  driverMiddleware, // or role check
  controller.getMyAssignedOrders.bind(controller),
);
router.patch(
  "/driver/:id/status",
  driverMiddleware,
  controller.driverUpdateStatus.bind(controller),
);
// admin assign driver
router.patch(
  "/:id/assign-driver",
  adminMiddleware,
  controller.assignDriver.bind(controller),
);
router.get("/:id", controller.getOrderById.bind(controller));
router.put("/:id/cancel", controller.cancelMyOrder);

export default router;
