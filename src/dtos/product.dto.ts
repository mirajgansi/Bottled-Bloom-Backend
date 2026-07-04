import { z } from "zod";
import { ProductSchema } from "../types/product.type";

export const CreateProductDto = ProductSchema.pick({
  name: true,
  description: true,
  price: true,
  brand: true,
  concentration: true,
  gender: true,
  volumeMl: true,
  fragranceNotes: true,
  category: true,
  inStock: true,
}).extend({
  existingImages: z.union([z.string(), z.array(z.string())]).optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),

  price: z.coerce.number().positive(),
  inStock: z.coerce.number().int().min(0).default(0),
  volumeMl: z.coerce.number().positive(),

  sku: z.string().optional(),
});

export type CreateProductDto = z.infer<typeof CreateProductDto>;

export const UpdateProductDto = ProductSchema.pick({
  name: true,
  description: true,
  price: true,
  brand: true,
  concentration: true,
  gender: true,
  volumeMl: true,
  fragranceNotes: true,
  category: true,
  inStock: true,
})
  .partial()
  .extend({
    existingImages: z.array(z.string()).optional(),

    price: z.coerce.number().positive().optional(),
    inStock: z.coerce.number().int().min(0).optional(),
    volumeMl: z.coerce.number().positive().optional(),

    brand: z.string().optional().or(z.literal("")),
    sku: z.string().optional().or(z.literal("")),
  });

export type UpdateProductDto = z.infer<typeof UpdateProductDto>;

export const RestockProductDto = z.object({
  quantity: z.coerce.number().int().min(0),
  mode: z.enum(["set", "add"]).optional().default("set"),
});

export type RestockProductDto = z.infer<typeof RestockProductDto>;

export const OutOfStockQueryDto = z.object({
  page: z.coerce.number().int().min(1).optional(),
  size: z.union([z.literal("all"), z.coerce.number().int().min(1)]).optional(),
  search: z.string().optional(),
  category: z.string().optional(),
});

export type OutOfStockQueryDto = z.infer<typeof OutOfStockQueryDto>;

export const RateProductDto = z.object({
  rating: z.coerce.number().min(1).max(5),
});

export type RateProductDto = z.infer<typeof RateProductDto>;

export const ToggleFavoriteDto = z.object({
  productId: z.string().optional(),
});

export type ToggleFavoriteDto = z.infer<typeof ToggleFavoriteDto>;

export const AddCommentDto = z.object({
  comment: z.string().min(1, "Comment cannot be empty"),
});

export type AddCommentDto = z.infer<typeof AddCommentDto>;
