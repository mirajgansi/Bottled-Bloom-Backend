import mongoose, { Schema, InferSchemaType } from "mongoose";

const CartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false },
);

const CartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true },
);

CartSchema.index({ userId: 1 });
CartSchema.index({ "items.productId": 1 });

export type Cart = InferSchemaType<typeof CartSchema>;
export const CartModel = mongoose.model<Cart>("Cart", CartSchema);
