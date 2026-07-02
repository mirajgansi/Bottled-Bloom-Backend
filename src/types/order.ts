import { z } from "zod";

export const OrderItemSchema = z.object({
  productId: z.string().min(1, "productId is required"),

  name: z.string().min(1, "Product name is required"),

  price: z.coerce.number().min(0, "Price cannot be negative"),

  image: z.string().optional(),

  quantity: z.coerce
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1"),

  lineTotal: z.coerce.number().min(0, "Line total cannot be negative"),
  assignedAt: z.coerce.date().nullable().optional(),
  deliveredAt: z.coerce.date().nullable().optional(),
});

export const ShippingAddressSchema = z.object({
  userName: z.string().min(2).optional(),

  phone: z.string().min(7).optional(),

  address1: z.string().min(3).optional(),

  address2: z.string().optional(),

  city: z.string().optional(),

  zip: z.string().optional(),
});

export const OrderStatusSchema = z.enum([
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
]);

export const OrderSchema = z.object({
  userId: z.string().min(1, "userId is required"),

  items: z
    .array(OrderItemSchema)
    .min(1, "Order must contain at least one item"),

  subtotal: z.coerce.number().min(0).default(0),

  shippingFee: z.coerce.number().min(0).default(0),

  total: z.coerce.number().min(0).default(0),

  status: OrderStatusSchema.default("pending"),

  paymentStatus: z.enum(["unpaid", "paid"]).default("unpaid"),

  shippingAddress: ShippingAddressSchema.optional(),

  notes: z.string().max(500).optional(),

  driverId: z.string().min(1).optional(),
  driverName: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  shippingFee: z.coerce.number().min(0).optional(),

  shippingAddress: ShippingAddressSchema.optional(),

  notes: z.string().max(500).optional(),
});

export const UpdateOrderStatusSchema = z
  .object({
    status: OrderStatusSchema,
    driverId: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === "shipped" && !val.driverId) {
      ctx.addIssue({
        code: "custom",
        path: ["driverId"],
        message: "Driver is required when marking order as shipped",
      });
    }
  });

export type OrderItemType = z.infer<typeof OrderItemSchema>;
export type ShippingAddressType = z.infer<typeof ShippingAddressSchema>;
export type OrderStatusType = z.infer<typeof OrderStatusSchema>;
export type OrderType = z.infer<typeof OrderSchema>;
export type CreateOrderType = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusType = z.infer<typeof UpdateOrderStatusSchema>;
