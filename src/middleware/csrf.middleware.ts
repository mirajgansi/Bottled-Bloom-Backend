// src/middleware/csrf.middleware.ts
import { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors/http-error";

const ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3003"];
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

export const csrfOriginCheck = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  // NEW — Socket.IO's own handshake has its own JWT-based auth (see
  // config/socket.ts). It is not a REST endpoint and doesn't carry a
  // standard browser Origin header the same way fetch/form requests do —
  // don't apply this check to it.
  if (req.path.startsWith("/socket.io")) return next();

  if (SAFE_METHODS.includes(req.method)) return next();

  const origin = req.headers.origin;

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return next(new HttpError(403, "Invalid request origin"));
  }

  next();
};
