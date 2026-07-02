import mongoose, { Schema, InferSchemaType } from "mongoose";

const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true }, // reference
    name: { type: String, required: true }, // snapshot
    price: { type: Number, required: true, min: 0 }, // snapshot
    image: { type: String }, // snapshot
    quantity: { type: Number, required: true, min: 1, default: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ShippingAddressSchema = new Schema(
  {
    userName: { type: String },
    phone: { type: String },
    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    country: { type: String },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    items: { type: [OrderItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0, default: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0, default: 0 },

    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    shippingAddress: { type: ShippingAddressSchema },
    notes: { type: String },
  },
  { timestamps: true },
);

// Helpful indexes
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ driverId: 1, createdAt: -1 });
export type Order = InferSchemaType<typeof OrderSchema>;
export const OrderModel = mongoose.model<Order>("Order", OrderSchema);
