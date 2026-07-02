import { Router } from "express";
import { AdminAnalyticsController } from "../../controllers/admin/admin.analytics.controller";
import {
  authorizedMiddleware,
  adminMiddleware,
} from "../../middleware/authorized.middleware";

const router = Router();
const adminAnalyticsController = new AdminAnalyticsController();

router.use(authorizedMiddleware, adminMiddleware);

router.get(
  "/kpis",
  adminAnalyticsController.kpis.bind(adminAnalyticsController),
);
router.get(
  "/earnings",
  adminAnalyticsController.earnings.bind(adminAnalyticsController),
);
router.get(
  "/category-share",
  adminAnalyticsController.categoryShare.bind(adminAnalyticsController),
);
router.get(
  "/top-products",
  adminAnalyticsController.topProducts.bind(adminAnalyticsController),
);
router.get(
  "/drivers",
  adminAnalyticsController.driversAnalytics.bind(adminAnalyticsController),
);

router.get(
  "/topView",
  adminAnalyticsController.topViewedProducts.bind(adminAnalyticsController),
);

export default router;
