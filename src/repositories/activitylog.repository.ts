import { ActivityLogModel, IActivityLog } from "../models/activitylog.model";

export interface ActivityLogInput {
  userId?: string;
  userEmail?: string;
  role?: string;
  action: string;
  category: IActivityLog["category"];
  severity?: IActivityLog["severity"];
  success?: boolean;
  method?: string;
  path?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export class ActivityLogRepository {
  async create(data: ActivityLogInput) {
    return ActivityLogModel.create({
      ...data,
      severity: data.severity ?? "info",
      success: data.success ?? true,
    });
  }

  async find({
    page = 1,
    size = 25,
    userId,
    action,
    category,
    severity,
    success,
    from,
    to,
  }: {
    page?: number;
    size?: number;
    userId?: string;
    action?: string;
    category?: string;
    severity?: string;
    success?: boolean;
    from?: Date;
    to?: Date;
  }) {
    const filter: Record<string, any> = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (success !== undefined) filter.success = success;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    const safePage = Math.max(1, page);
    const safeSize = Math.min(200, Math.max(1, size));
    const skip = (safePage - 1) * safeSize;

    const [logs, total] = await Promise.all([
      ActivityLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeSize)
        .lean(),
      ActivityLogModel.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        page: safePage,
        size: safeSize,
        total,
        totalPages: Math.ceil(total / safeSize),
      },
    };
  }

  async countRecentFailedLogins(email: string, windowMs: number) {
    const since = new Date(Date.now() - windowMs);
    return ActivityLogModel.countDocuments({
      action: "auth.login",
      success: false,
      "metadata.attemptedEmail": email,
      createdAt: { $gte: since },
    });
  }
}
