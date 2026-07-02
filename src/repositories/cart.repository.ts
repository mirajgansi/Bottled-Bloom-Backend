import type { HydratedDocument } from "mongoose";
import { Cart, CartModel } from "../models/cart.model";

export class CartRepository {
  getCartByUserId(userId: string): Promise<HydratedDocument<Cart> | null> {
    return CartModel.findOne({ userId }).populate("items.productId");
  }

  createCartForUser(userId: string): Promise<HydratedDocument<Cart>> {
    return CartModel.create({ userId, items: [] });
  }

  async getOrCreateCart(userId: string) {
    let cart = await CartModel.findOne({ userId });
    if (!cart) cart = await CartModel.create({ userId, items: [] });
    return cart;
  }

  async addItem(userId: string, productId: string, qty = 1) {
    const cart = await this.getOrCreateCart(userId);

    const existing = cart.items.find(
      (i) => i.productId.toString() === productId,
    );

    if (existing) existing.quantity += qty;
    else cart.items.push({ productId: productId as any, quantity: qty });

    return cart.save();
  }

  async updateQuantity(userId: string, productId: string, qty: number) {
    const cart = await this.getOrCreateCart(userId);

    const findIndex = cart.items.findIndex((i: any) => {
      const pid = i.productId;

      // populated doc -> pid._id
      if (pid && typeof pid === "object" && pid._id) {
        return String(pid._id) === String(productId);
      }

      // ObjectId or string
      return String(pid) === String(productId);
    });

    if (findIndex === -1) return null;

    if (qty <= 0) {
      cart.items.splice(findIndex, 1);
    } else {
      cart.items[findIndex].quantity = qty;
    }

    return cart.save();
  }
  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreateCart(userId);
    const index = cart.items.findIndex(
      (i) => i.productId.toString() === productId,
    );
    if (index > -1) cart.items.splice(index, 1);
    return cart.save();
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    cart.items.splice(0, cart.items.length);
    return cart.save();
  }
}
