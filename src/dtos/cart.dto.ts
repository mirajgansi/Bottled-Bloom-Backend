import { z } from "zod";

// Add item to cart
export const AddToCartDto = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(1).default(1),
});
export type AddToCartDtoType = z.infer<typeof AddToCartDto>;

// Change quantity (set quantity)
export const UpdateCartItemDto = z.object({
  quantity: z.number().int().min(1, "quantity must be at least 1"),
});
export type UpdateCartItemDtoType = z.infer<typeof UpdateCartItemDto>;

// Remove item (you can also send productId in params instead of body)
export const RemoveCartItemDto = z.object({
  productId: z.string().min(1, "productId is required"),
});
export type RemoveCartItemDtoType = z.infer<typeof RemoveCartItemDto>;
