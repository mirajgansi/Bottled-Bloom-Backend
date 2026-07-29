import { CreateUserDTO, UpdateUserDTO } from "../../dtos/user.dto";
import { Request, Response, NextFunction } from "express";
import z from "zod";
import { AdminUserService } from "../../services/admin/user.service";
import { getParam } from "../../utils/params";
import { activityLogService } from "../../services/activitylog.service";

let adminUserService = new AdminUserService();
interface QueryParams {
  page?: string;
  size?: string;
  search?: string;
}
export class AdminUserController {
  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = CreateUserDTO.safeParse(req.body); // validate request body
      if (!parsedData.success) {
        // validation failed
        return res
          .status(400)
          .json({ success: false, message: z.prettifyError(parsedData.error) });
      }
      if (req.file) {
        parsedData.data.image = `/uploads/${req.file.filename}`;
      }
      const userData: CreateUserDTO = parsedData.data;
      const newUser = await adminUserService.createUser(userData);

      activityLogService.logAdminAction({
        adminId: req.user!._id.toString(),
        adminEmail: (req.user as any).email,
        action: "admin.user.create",
        targetId: newUser._id.toString(),
        ip: req.ip,
        message: `Admin created user ${newUser.email}`,
      });

      return res
        .status(201)
        .json({ success: true, message: "User Created", data: newUser });
    } catch (error: Error | any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, size, search, role } = req.query as any; // ✅ include role

      const filter: any = {};
      if (role) filter.role = role; // ✅ driver/admin/user etc.

      const users = await adminUserService.getAllUsers({
        page,
        size,
        search,
        filter,
      });

      return res
        .status(200)
        .json({ success: true, data: users, message: "All Users Retrieved" });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getParam(req, "id");
      const parsedData = UpdateUserDTO.safeParse(req.body);
      if (!parsedData.success) {
        return res
          .status(400)
          .json({ success: false, message: z.prettifyError(parsedData.error) });
      }

      if (req.file) {
        parsedData.data.image = `/uploads/${req.file.filename}`;
      }
      const updateData: UpdateUserDTO = parsedData.data;

      // CHANGED — pass the calling admin's own id through
      const callingAdminId = req.user?._id?.toString();
      const updatedUser = await adminUserService.updateUser(
        userId,
        updateData,
        callingAdminId,
      );

      activityLogService.logAdminAction({
        adminId: callingAdminId!,
        adminEmail: (req.user as any).email,
        action: "admin.user.update",
        targetId: userId,
        ip: req.ip,
        message: `Admin updated user ${userId}`,
      });

      return res
        .status(200)
        .json({ success: true, message: "User Updated", data: updatedUser });

      return res
        .status(200)
        .json({ success: true, message: "User Updated", data: updatedUser });
    } catch (error: Error | any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const userId = getParam(req, "id");
      const callingAdminId = req.user?._id?.toString();
      activityLogService.logAdminAction({
        adminId: callingAdminId!,
        adminEmail: (req.user as any).email,
        action: "admin.user.delete",
        targetId: userId,
        ip: req.ip,
        message: `Admin deleted user ${userId}`,
      });
      const deleted = await adminUserService.deleteUser(userId, callingAdminId);
      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
      return res.status(200).json({ success: true, message: "User Deleted" });
    } catch (error: Error | any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getParam(req, "id");
      const user = await adminUserService.getUserById(userId);
      return res
        .status(200)
        .json({ success: true, data: user, message: "Single User Retrieved" });
    } catch (error: Error | any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
}
