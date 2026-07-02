// routes/cart.route.ts
import { Router } from "express";
import { CartController } from "../controllers/cart.controller";
import { authorizedMiddleware } from "../middleware/authorized.middleware";

const router = Router();
const controller = new CartController();

router.use(authorizedMiddleware);

router.get("/", controller.getMyCart.bind(controller));
router.post("/items", controller.addItem.bind(controller));
router.put("/items/:productId", controller.updateItemQuantity.bind(controller));
router.delete("/items/:productId", controller.removeItem.bind(controller));
router.delete("/", controller.clearCart.bind(controller));

export default router;
