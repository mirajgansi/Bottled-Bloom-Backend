import { UserModel } from "../models/user.model";
import {
  ActivityLogInput,
  ActivityLogRepository,
} from "../repositories/activitylog.repository";
import { NotificationService } from "./notification.service";

const repo = new ActivityLogRepository();
const notificationService = new NotificationService();

const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min
const FAILED_LOGIN_ALERT_THRESHOLD = 5;

export class ActivityLogService {
  log(data: ActivityLogInput) {
    repo
      .create(data)
      .catch((err) => console.error("ActivityLog write failed:", err.message));
  }

  logLoginAttempt(params: {
    success: boolean;
    email: string;
    userId?: string;
    role?: string;
    ip?: string;
    userAgent?: string;
    reason?: string;
  }) {
    const { success, email, userId, role, ip, userAgent, reason } = params;

    this.log({
      userId,
      userEmail: email,
      role,
      action: "auth.login",
      category: "auth",
      severity: success ? "info" : "warning",
      success,
      ip,
      userAgent,
      message: success
        ? "Login successful"
        : `Login failed: ${reason ?? "invalid credentials"}`,
      metadata: { attemptedEmail: email },
    });

    if (!success) {
      this.checkBruteForce(email, ip).catch((err) =>
        console.error("Brute-force check failed:", err.message),
      );
    }
  }

  private async checkBruteForce(email: string, ip?: string) {
    const recentFailures = await repo.countRecentFailedLogins(
      email,
      FAILED_LOGIN_WINDOW_MS,
    );
    if (recentFailures < FAILED_LOGIN_ALERT_THRESHOLD) return;

    this.log({
      userEmail: email,
      action: "security.brute_force_suspected",
      category: "security",
      severity: "critical",
      success: false,
      ip,
      message: `${recentFailures} failed login attempts for ${email} in the last 15 minutes`,
      metadata: { attemptedEmail: email, failureCount: recentFailures },
    });

    // Reuses your existing notification system (bell icon / notifications page) — no new infra.
    const admins = await UserModel.find({ role: "admin" }).select("_id");
    await Promise.all(
      admins.map((a) =>
        notificationService.notify({
          to: a._id.toString(),
          type: "system",
          title: "Suspicious login activity",
          message: `${recentFailures} failed login attempts detected for ${email}.`,
          data: { url: "/admin/security/logs" },
        }),
      ),
    );
  }

  logAdminAction(params: {
    adminId: string;
    adminEmail?: string;
    action: string;
    targetId?: string;
    ip?: string;
    userAgent?: string;
    message?: string;
    metadata?: Record<string, any>;
  }) {
    this.log({
      userId: params.adminId,
      userEmail: params.adminEmail,
      role: "admin",
      action: params.action,
      category: "admin",
      severity: "info",
      success: true,
      ip: params.ip,
      userAgent: params.userAgent,
      message: params.message,
      metadata: { targetId: params.targetId, ...params.metadata },
    });
  }

  logSecurityEvent(params: {
    action: string;
    severity?: "info" | "warning" | "critical";
    userId?: string;
    userEmail?: string;
    ip?: string;
    userAgent?: string;
    message?: string;
    metadata?: Record<string, any>;
  }) {
    this.log({
      ...params,
      category: "security",
      success: false,
      severity: params.severity ?? "warning",
    });
  }

  async getLogs(query: Parameters<ActivityLogRepository["find"]>[0]) {
    return repo.find(query);
  }
}

export const activityLogService = new ActivityLogService();
