import { Types } from "mongoose";

export type CartItem = {
  productId: Types.ObjectId;
  quantity: number;
};

export type CartDoc = {
  userId: Types.ObjectId;
  items: CartItem[];
  createdAt?: Date;
  updatedAt?: Date;
};
