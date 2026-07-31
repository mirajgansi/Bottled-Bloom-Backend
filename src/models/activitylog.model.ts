import mongoose, { Schema, Document } from "mongoose";

export type ActivityCategory =
  | "auth"
  | "security"
  | "admin"
  | "data"
  | "access"
  | "system"
  | "order";
export type ActivitySeverity = "info" | "warning" | "critical";

export interface IActivityLog extends Document {
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  role?: string;
  action: string;
  category: ActivityCategory;
  severity: ActivitySeverity;
  success: boolean;
  method?: string;
  path?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  message?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userEmail: { type: String },
    role: { type: String },
    action: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ["auth", "security", "admin", "data", "access", "system"],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
      index: true,
    },
    success: { type: Boolean, default: true },
    method: String,
    path: String,
    statusCode: Number,
    ip: String,
    userAgent: String,
    message: String,
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ category: 1, severity: 1, createdAt: -1 });

// Optional retention (uncomment once you've decided a policy for the report):
// ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export const ActivityLogModel = mongoose.model<IActivityLog>(
  "ActivityLog",
  ActivityLogSchema,
);
