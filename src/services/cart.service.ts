import { HttpError } from "../errors/http-error";
import { CartRepository } from "../repositories/cart.repository";

const cartRepository = new CartRepository();

export class CartService {
  async getMyCart(userId: string) {
    const cart = await cartRepository.getCartByUserId(userId);
    if (!cart) return await cartRepository.createCartForUser(userId);
    return cart;
  }

  async addToCart(userId: string, productId: string, quantity = 1) {
    if (quantity < 1) throw new HttpError(400, "Quantity must be at least 1");
    return cartRepository.addItem(userId, productId, quantity);
  }

  async changeQuantity(userId: string, productId: string, quantity: number) {
    const cart = await cartRepository.updateQuantity(
      userId,
      productId,
      quantity,
    );
    if (!cart) throw new HttpError(404, "Item not found in cart");
    return cart;
  }

  async removeFromCart(userId: string, productId: string) {
    return cartRepository.removeItem(userId, productId);
  }

  async clearMyCart(userId: string) {
    return cartRepository.clearCart(userId);
  }
}
