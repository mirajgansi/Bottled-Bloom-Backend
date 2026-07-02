import z from "zod";
export const CATEGORIES = [
  "meat",
  "oil",
  "pulses",
  "bakery",
  "snacks",
  "beverages",
] as const;

const RatingSchema = z.object({
  userId: z.string(),
  rating: z.number().min(1).max(5),
});

const CommentSchema = z.object({
  userId: z.string(),
  username: z.string(),
  comment: z.string().min(1, "Comment cannot be empty"),
  createdAt: z.string().datetime().optional(),
});

export const ProductSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),

  description: z.string().min(10, "Description must be at least 10 characters"),

  price: z.coerce.number().positive("Price must be greater than 0"),
  inStock: z.coerce.number().int("Stock must be an integer").min(0).default(0),
  manufacturer: z.string().min(1, "Manufacturer is required"),

  manufactureDate: z.string().optional().nullable(),
  expireDate: z.string().optional().nullable(),
  nutritionalInfo: z.string().min(1, "Nutritional info is required"),

  category: z.enum(CATEGORIES, {
    message: "Category is required",
  }),
  image: z.string().min(1, "Image is required").optional(),
  images: z.array(z.string()).optional(),

  ratings: z.array(RatingSchema).default([]),
  averageRating: z.number().min(0).max(5).default(0),
  reviewCount: z.number().int().min(0).default(0),

  favorites: z.array(z.string()).default([]),

  comments: z.array(CommentSchema).default([]),

  totalSold: z.number().int().min(0).default(0),

  totalRevenue: z.number().min(0).default(0),

  viewCount: z.number().int().min(0).default(0),
});

export type ProductType = z.infer<typeof ProductSchema>;
