import { Request, Response } from "express";
import { OrderService } from "../services/order.service";
import { AssignDriverDto, UpdateOrderStatusDto } from "../dtos/order.dto";
import { HttpError } from "../errors/http-error";

const orderService = new OrderService();

interface QueryParams {
  page?: string;
  size?: string;
  search?: string;
  tab?: string;
}

export class OrderController {
  // POST /api/orders  (checkout -> create from cart)
  async createFromCart(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new HttpError(401, "Unauthorized");

      const order = await orderService.createFromCart(userId, req.body);

      return res.status(201).json({
        success: true,
        message: "Order created",
        data: order,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async getMyOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new HttpError(401, "Unauthorized");

      const orders = await orderService.getMyOrders(userId);

      return res.json({
        success: true,
        data: orders,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // GET /api/orders/:id
  async getOrderById(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;

      const order = await orderService.getOrderById(req.params.id);

      // user can only see own order (admin can see all)
      if (
        role !== "admin" &&
        role !== "driver" &&
        String(order.userId) !== String(userId)
      ) {
        throw new HttpError(403, "Forbidden");
      }

      return res.json({
        success: true,
        data: order,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ADMIN: GET /api/orders
  async getAllOrders(req: Request, res: Response) {
    try {
      const { page, size, search, tab }: QueryParams = req.query;

      const orders = await orderService.getAllOrders({
        page,
        size,
        search,
        tab,
      });

      return res.status(200).json({
        success: true,
        message: "Orders fetched successfully",
        data: orders,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const parsed = UpdateOrderStatusDto.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid input",
          issues: parsed.error.issues,
        });
      }

      const updated = await orderService.updateStatus(
        req.params.id,
        parsed.data,
      );

      return res.json({
        success: true,
        message: "Order updated",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async cancelMyOrder(req: Request, res: Response) {
    try {
      const userId = req.user!._id;
      const updated = await orderService.cancelMyOrder(req.params.id, userId);

      return res.json({
        success: true,
        message: "Order cancelled",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async assignDriver(req: Request, res: Response) {
    try {
      const parsed = AssignDriverDto.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid input",
          issues: parsed.error.issues,
        });
      }

      const adminId = req.user?._id;
      if (!adminId) throw new HttpError(401, "Unauthorized");

      const updated = await orderService.assignDriver(
        req.params.id,
        parsed.data.driverId,
        adminId,
      );

      return res.json({
        success: true,
        message: "Driver assigned",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async getMyAssignedOrders(req: Request, res: Response) {
    try {
      const driverId = req.user?._id;
      if (!driverId) throw new HttpError(401, "Unauthorized");

      const page = Number(req.query.page ?? "1");
      const size = Number(req.query.size ?? "10");

      const data = await orderService.getMyAssignedOrders(driverId, page, size);

      return res.json({
        success: true,
        message: "Assigned orders fetched",
        ...data,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async driverUpdateStatus(req: any, res: Response) {
    try {
      const driverId = req.user.id; // from authorizedMiddleware
      const { id } = req.params; // orderId
      const { status } = req.body; // "shipped" | "delivered"

      const updated = await orderService.driverUpdateStatus(
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
}
