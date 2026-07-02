import { z } from "zod";
import mongoose from "mongoose";

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid ObjectId");

export const createNotificationDto = z.object({
  to: objectId,
  from: objectId.optional(),
  role: z.enum(["admin", "driver", "user"]).optional(),
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  type: z.enum([
    "driver_assigned",
    "driver_eta",
    "order_shipped",
    "order_delivered",
    "product_added",
    "system",
  ]),
  data: z
    .object({
      orderId: z.string().optional(),
      productId: z.string().optional(),
      etaMinutes: z.number().optional(),
      location: z.object({ lat: z.number(), lng: z.number() }).optional(),
      url: z.string().optional(),
    })
    .optional(),
});

export type CreateNotificationDTO = z.infer<typeof createNotificationDto>;

export const listNotificationsQueryDto = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
  read: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type ListNotificationsQueryDTO = z.infer<
  typeof listNotificationsQueryDto
>;

export const markAsReadDto = z.object({
  notificationId: objectId,
});

export type MarkAsReadDTO = z.infer<typeof markAsReadDto>;
