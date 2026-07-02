import { z } from "zod";
import { OrderSchema, OrderStatusSchema } from "../types/order";

export const CreateOrderDto = OrderSchema.pick({
  shippingFee: true,
  shippingAddress: true,
  notes: true,
}).extend({
  shippingFee: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateOrderDto = OrderSchema.partial();

export const UpdateOrderStatusDto = z
  .object({
    status: OrderStatusSchema,
    paymentStatus: z.enum(["unpaid", "paid"]).optional(),

    driverId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // require driver when shipping
    if (data.status === "shipped" && !data.driverId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["driverId"],
        message: "driverId is required when status is shipped",
      });
    }

    // optional: prevent driverId on cancelled/pending if you want
    // if (data.status === "cancelled" && data.driverId) { ... }
  });
export const AssignDriverDto = z.object({
  driverId: z.string().min(1, "driverId is required"),
});
export type AssignDriverDto = z.infer<typeof AssignDriverDto>;

export type CreateOrderDto = z.infer<typeof CreateOrderDto>;
export type UpdateOrderDto = z.infer<typeof UpdateOrderDto>;
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusDto>;
