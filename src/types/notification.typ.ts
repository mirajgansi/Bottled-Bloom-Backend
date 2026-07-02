// notification.schema.ts
import { z } from "zod";
import mongoose from "mongoose";

export const createNotificationSchema = z.object({
  user: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid user id",
  }),

  title: z.string().min(1, "Title is required").max(100, "Title too long"),

  message: z
    .string()
    .min(1, "Message is required")
    .max(500, "Message too long"),

  type: z.enum(["order", "system", "payment"]).default("system"),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
