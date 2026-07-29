import { Request, Response } from "express";
import { activityLogService } from "../../services/activitylog.service";

export class ActivityLogController {
  async list(req: Request, res: Response) {
    try {
      const {
        page,
        size,
        userId,
        action,
        category,
        severity,
        success,
        from,
        to,
      } = req.query as Record<string, string>;

      const result = await activityLogService.getLogs({
        page: page ? parseInt(page) : 1,
        size: size ? parseInt(size) : 25,
        userId,
        action,
        category,
        severity,
        success: success !== undefined ? success === "true" : undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });

      return res.json({ success: true, ...result });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch logs",
      });
    }
  }
}
