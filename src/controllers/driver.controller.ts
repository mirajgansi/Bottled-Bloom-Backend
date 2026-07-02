import { Request, Response } from "express";
import { DriverService } from "../services/driver.service";

const driverService = new DriverService();

export class DriverController {
  // PATCH /driver/:id/status  (driverMiddleware)
  async driverUpdateStatus(req: any, res: Response) {
    try {
      const driverId = req.user.id; // from authorizedMiddleware
      const { id } = req.params; // orderId
      const { status } = req.body; // "shipped" | "delivered"

      const updated = await driverService.driverUpdateStatus(
        driverId,
        id,
        status,
      );

      return res.status(200).json({
        success: true,
        message: "Order status updated",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
  async driverUpdateOrderStatus(req: Request, res: Response) {
    const { id: orderId } = req.params;
    const { status } = req.body as { status: "shipped" | "delivered" };

    const result = await driverService.driverUpdateOrderStatus(orderId, status);
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  }

  async getDriversByStats(req: Request, res: Response) {
    const { search } = req.query as { search?: string };
    const result = await driverService.getDriversWithStats({ search });
    return res.json(result);
  }

  async getDriverStatsById(req: Request, res: Response) {
    const { id } = req.params;

    const stats = await driverService.getDriverStatsById(id);

    return res.json({
      success: true,
      data: stats,
    });
  }
  async getDriverDetailById(req: Request, res: Response) {
    const { id } = req.params;
    const { page = "1", size = "10" } = req.query as any;

    const result = await driverService.getDriverDetailById(
      id,
      Number(page),
      Number(size),
    );

    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  }
}
