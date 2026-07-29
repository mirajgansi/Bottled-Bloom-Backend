import { Request, Response, NextFunction } from "express";
import { activityLogService } from "../services/activitylog.service";

const EXCLUDED_PREFIXES = ["/uploads"];

export function activityLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (EXCLUDED_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const start = Date.now();

  res.on("finish", () => {
    // Skip noisy successful GETs — keep the log useful, not flooded.
    if (req.method === "GET" && res.statusCode < 400) return;

    const durationMs = Date.now() - start;
    const user = (req as any).user; // set by authorizedMiddleware upstream, if present by the time 'finish' fires

    activityLogService.log({
      userId: user?._id?.toString(),
      userEmail: user?.email,
      role: user?.role,
      action: `${req.method} ${req.route?.path ?? req.path}`,
      category: "access",
      severity:
        res.statusCode >= 500
          ? "critical"
          : res.statusCode >= 400
            ? "warning"
            : "info",
      success: res.statusCode < 400,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
      message: `${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`,
      // NOTE: req.body is intentionally never included — see "what's excluded" below.
    });
  });

  next();
}
