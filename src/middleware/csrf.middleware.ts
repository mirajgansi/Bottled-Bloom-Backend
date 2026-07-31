import { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors/http-error";

const ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3003"];
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

export const csrfOriginCheck = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (req.path.startsWith("/socket.io")) return next();

  if (SAFE_METHODS.includes(req.method)) return next();

  const origin = req.headers.origin;

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return next(new HttpError(403, "Invalid request origin"));
  }

  next();
};
