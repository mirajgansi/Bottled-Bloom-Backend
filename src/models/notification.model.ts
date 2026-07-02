import { Schema, model, Types } from "mongoose";

export type NotificationType =
  | "driver_assigned"
  | "driver_eta"
  | "order_shipped"
  | "order_delivered"
  | "product_added"
  | "system";
export type UserRole = "admin" | "driver" | "user";

export type NotificationDoc = {
  _id: Types.ObjectId;

  to: Types.ObjectId; // receiver (user/driver/admin)
  from?: Types.ObjectId; // sender (admin/driver) optional

  title: string;
  message: string;
  type: NotificationType;

  read: boolean;
  role?: UserRole;
  data?: {
    orderId?: string;
    productId?: string;
    etaMinutes?: number;
    location?: { lat: number; lng: number };
    url?: string; // for front-end deep link like "/orders/123"
  };

  createdAt: Date;
  updatedAt: Date;
};

const notificationSchema = new Schema<NotificationDoc>(
  {
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    from: { type: Schema.Types.ObjectId, ref: "User" },

    title: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 500 },

    type: {
      type: String,
      enum: [
        "driver_assigned",
        "driver_eta",
        "order_shipped",
        "order_delivered",
        "product_added",
        "system",
      ],
      default: "system",
      required: true,
    },

    read: { type: Boolean, default: false },

    data: {
      orderId: { type: String },
      productId: { type: String },
      etaMinutes: { type: Number },
      location: {
        lat: { type: Number },
        lng: { type: Number },
      },
      url: { type: String },
    },
  },
  { timestamps: true },
);

// ✅ helpful indexes (fast notification bell)
notificationSchema.index({ to: 1, read: 1, createdAt: -1 });

export const NotificationModel = model<NotificationDoc>(
  "Notification",
  notificationSchema,
);
