import { Request, Response } from "express";
import { HttpError } from "../errors/http-error";
import { CartService } from "../services/cart.service";
import { AddToCartDto, UpdateCartItemDto } from "../dtos/cart.dto";

const cartService = new CartService();

// Helper: adapt this to your auth middleware
function getUserId(req: Request): string {
  // common patterns:
  const anyReq = req as any;
  const userId = anyReq.userId || anyReq.user?.id || anyReq.user?._id;
  if (!userId) throw new HttpError(401, "Unauthorized");
  return String(userId);
}

export class CartController {
  // GET /cart
  async getMyCart(req: Request, res: Response) {
    const userId = getUserId(req);
    const cart = await cartService.getMyCart(userId);
    return res.status(200).json({ success: true, data: cart });
  }

  // POST /cart/items
  async addItem(req: Request, res: Response) {
    const userId = getUserId(req);

    const parsed = AddToCartDto.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
      );
    }

    const { productId, quantity } = parsed.data;
    const cart = await cartService.addToCart(userId, productId, quantity);

    return res
      .status(200)
      .json({ success: true, message: "Added to cart", data: cart });
  }

  // PATCH /cart/items/:productId
  async updateItemQuantity(req: Request, res: Response) {
    const userId = getUserId(req);
    const productId = req.params.productId;

    if (!productId) throw new HttpError(400, "productId param is required");

    const parsed = UpdateCartItemDto.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
      );
    }

    const { quantity } = parsed.data;
    const cart = await cartService.changeQuantity(userId, productId, quantity);

    return res.status(200).json({
      success: true,
      message: "Cart item updated",
      data: cart,
    });
  }

  // DELETE /cart/items/:productId
  async removeItem(req: Request, res: Response) {
    const userId = getUserId(req);
    const productId = req.params.productId;

    if (!productId) throw new HttpError(400, "productId param is required");

    const cart = await cartService.removeFromCart(userId, productId);

    return res.status(200).json({
      success: true,
      message: "Removed from cart",
      data: cart,
    });
  }

  // DELETE /cart
  async clearCart(req: Request, res: Response) {
    const userId = getUserId(req);
    const cart = await cartService.clearMyCart(userId);

    return res.status(200).json({
      success: true,
      message: "Cart cleared",
      data: cart,
    });
  }
}
