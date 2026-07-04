import z from "zod";

export const CATEGORIES = [
  "eau-de-parfum",
  "eau-de-toilette",
  "attar-oud",
  "womens",
  "mens",
  "body-mist",
  "gift-sets",
] as const;

export const CONCENTRATIONS = [
  "parfum",
  "eau-de-parfum",
  "eau-de-toilette",
  "eau-de-cologne",
  "attar",
] as const;

export const GENDERS = ["men", "women", "unisex"] as const;

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

  brand: z.string().min(1, "Brand is required"),

  description: z.string().min(10, "Description must be at least 10 characters"),

  price: z.coerce.number().positive("Price must be greater than 0"),
  inStock: z.coerce.number().int("Stock must be an integer").min(0).default(0),

  category: z.enum(CATEGORIES, {
    message: "Category is required",
  }),

  concentration: z.enum(CONCENTRATIONS, {
    message: "Concentration is required",
  }),

  gender: z.enum(GENDERS, {
    message: "Gender is required",
  }),

  volumeMl: z.coerce.number().positive("Volume must be greater than 0"),

  fragranceNotes: z
    .object({
      top: z.array(z.string()).optional(),
      heart: z.array(z.string()).optional(),
      base: z.array(z.string()).optional(),
    })
    .optional(),

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
