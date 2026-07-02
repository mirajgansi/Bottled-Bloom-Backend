import { Router } from "express";
import {
  authorizedMiddleware,
  adminMiddleware,
} from "../middleware/authorized.middleware";
import { uploads } from "../middleware/upload.middleware";
import { ProductController } from "../controllers/product.controller";

const router = Router();
const productController = new ProductController();

router.post(
  "/",
  authorizedMiddleware,
  adminMiddleware,
  uploads.array("image", 3),
  productController.createProduct.bind(productController),
);

router.put(
  "/:id",
  authorizedMiddleware,
  adminMiddleware,
  uploads.array("image", 3),
  productController.updateProduct.bind(productController),
);

router.put(
  "/:id/restock",
  authorizedMiddleware,
  adminMiddleware,
  productController.restockProduct.bind(productController),
);

router.delete(
  "/:id",
  authorizedMiddleware,
  adminMiddleware,
  productController.deleteProduct.bind(productController),
);
router.post(
  "/:id/rate",
  authorizedMiddleware,
  productController.rateProduct.bind(productController),
);

router.post(
  "/:id/favorite",
  authorizedMiddleware,
  productController.toggleFavorite.bind(productController),
);

router.post(
  "/:id/comment",
  authorizedMiddleware,
  productController.addComment.bind(productController),
);

router.get(
  "/favorites/me",
  authorizedMiddleware,
  productController.getUserFavorites.bind(productController),
);
//  Get all
router.get("/", productController.getAllProducts.bind(productController));

router.get(
  "/category/:category",
  productController.getProductsByCategory.bind(productController),
);

router.get(
  "/recent",
  productController.getRecentlyAdded.bind(productController),
);

router.get("/trending", productController.getTrending.bind(productController));

router.get(
  "/popular",
  productController.getMostPopular.bind(productController),
);

router.get("/top-rated", productController.getTopRated.bind(productController));

router.get(
  "/out-of-stock",
  productController.getOutOfStockProducts.bind(productController),
);
router.patch(
  "/:id/view",
  productController.incrementViewCount.bind(productController),
);
router.get(
  "/:id/comments",
  productController.getProductComments.bind(productController),
);

router.get("/:id", productController.getProductById.bind(productController));

export default router;
