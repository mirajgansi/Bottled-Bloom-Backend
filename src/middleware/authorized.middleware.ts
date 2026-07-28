import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { IUser } from "../models/user.model";
import { UserRepository } from "../repositories/user.repository";
import { HttpError } from "../errors/http-error";
import { JWT_SECRET } from "../config";

declare global {
  namespace Express {
    interface Request {
      user?: Record<string, any> | IUser;
    }
  }
}
let userRepository = new UserRepository();

export const authorizedMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      throw new HttpError(401, "Unauthorized");

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as Record<string, any>;

    if (!decodedToken || !decodedToken.id) {
      throw new HttpError(401, "Unauthorized");
    }
    const user = await userRepository.getUserById(decodedToken.id);
    if (!user) throw new HttpError(401, "Unauthorized");

    if ((decodedToken.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new HttpError(401, "Session expired, please log in again");
    }
    req.user = user;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (err instanceof HttpError) {
      return res
        .status(err.statusCode)
        .json({ success: false, message: err.message });
    }
    console.error("[authorizedMiddleware] unexpected error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized no user info");
    }
    if (req.user.role !== "admin") {
      throw new HttpError(403, "Forbidden not admin");
    }
    return next();
  } catch (err: Error | any) {
    return res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
};

export const driverMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized no user info");
    }
    if (req.user.role !== "driver") {
      throw new HttpError(403, "Forbidden not driver");
    }
    return next();
  } catch (err: Error | any) {
    return res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
};
