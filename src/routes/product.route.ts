import { Router } from "express";
import {
  authorizedMiddleware,
  adminMiddleware,
} from "../middleware/authorized.middleware";
import { uploads } from "../middleware/upload.middleware";
import { ProductController } from "../controllers/product.controller";
import {
  publicReadLimiter,
  writeActionLimiter,
} from "../middleware/ratelimit.middleware";

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

// ---- USER WRITES — add writeActionLimiter ----
router.post(
  "/:id/rate",
  authorizedMiddleware,
  writeActionLimiter,
  productController.rateProduct.bind(productController),
);

router.post(
  "/:id/favorite",
  authorizedMiddleware,
  writeActionLimiter,
  productController.toggleFavorite.bind(productController),
);

router.post(
  "/:id/comment",
  authorizedMiddleware,
  writeActionLimiter,
  productController.addComment.bind(productController),
);

router.get(
  "/favorites/me",
  authorizedMiddleware,
  productController.getUserFavorites.bind(productController),
);

// ---- PUBLIC READS — add publicReadLimiter ----
router.get(
  "/",
  publicReadLimiter,
  productController.getAllProducts.bind(productController),
);

router.get(
  "/category/:category",
  publicReadLimiter,
  productController.getProductsByCategory.bind(productController),
);

router.get(
  "/recent",
  publicReadLimiter,
  productController.getRecentlyAdded.bind(productController),
);

router.get(
  "/trending",
  publicReadLimiter,
  productController.getTrending.bind(productController),
);

router.get(
  "/popular",
  publicReadLimiter,
  productController.getMostPopular.bind(productController),
);

router.get(
  "/top-rated",
  publicReadLimiter,
  productController.getTopRated.bind(productController),
);

router.get(
  "/out-of-stock",
  publicReadLimiter,
  productController.getOutOfStockProducts.bind(productController),
);

router.patch(
  "/:id/view",
  publicReadLimiter,
  productController.incrementViewCount.bind(productController),
);

router.get(
  "/:id/comments",
  publicReadLimiter,
  productController.getProductComments.bind(productController),
);

// keep this LAST — it's the catch-all and would otherwise shadow the routes above
router.get(
  "/:id",
  publicReadLimiter,
  productController.getProductById.bind(productController),
);

export default router;
