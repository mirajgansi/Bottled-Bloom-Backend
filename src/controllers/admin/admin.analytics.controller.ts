import { Request, Response } from "express";
import { AdminAnalyticsService } from "../../services/admin/analytics.service";

function parseRange(req: Request) {
  const from = req.query.from
    ? new Date(String(req.query.from))
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

export class AdminAnalyticsController {
  private service = new AdminAnalyticsService();

  async kpis(req: Request, res: Response) {
    const range = parseRange(req);
    const data = await this.service.getKpis(range);
    return res.json({ success: true, data });
  }

  async earnings(req: Request, res: Response) {
    const range = parseRange(req);
    const group = String(req.query.group || "daily") as any;
    const data = await this.service.getEarnings(range, group);
    return res.json({ success: true, data });
  }

  async categoryShare(req: Request, res: Response) {
    const range = parseRange(req);
    const data = await this.service.getCategoryShare(range);
    return res.json({ success: true, data });
  }

  async topProducts(req: Request, res: Response) {
    const range = parseRange(req);
    const limit = Number(req.query.limit || 10);
    const data = await this.service.getTopProducts(range, limit);
    return res.json({ success: true, data });
  }

  async driversAnalytics(req: Request, res: Response) {
    const range = parseRange(req);
    const limit = Number(req.query.limit || 10);
    const data = await this.service.getDriversAnalytics(range, limit);
    return res.json({ success: true, data });
  }

  async topViewedProducts(req: Request, res: Response) {
    try {
      const limit = Number(req.query.limit || 10);
      const data = await this.service.getTopViewedProducts(limit);

      return res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch top viewed products",
      });
    }
  }
}
