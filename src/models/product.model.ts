import mongoose, { HydratedDocument, Schema } from "mongoose";
import { ProductType } from "../types/product.type";

export type ProductDoc = HydratedDocument<ProductType>;

const RatingSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  { _id: false },
);

const CommentSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const FragranceNotesSchema = new Schema(
  {
    top: [{ type: String }],
    heart: [{ type: String }],
    base: [{ type: String }],
  },
  { _id: false },
);

const ProductSchema = new Schema<ProductType>(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0, index: true },
    category: { type: String, required: true, index: true },

    concentration: {
      type: String,
      required: true,
      enum: [
        "parfum",
        "eau-de-parfum",
        "eau-de-toilette",
        "eau-de-cologne",
        "attar",
      ],
      index: true,
    },
    gender: {
      type: String,
      required: true,
      enum: ["men", "women", "unisex"],
      index: true,
    },
    volumeMl: { type: Number, required: true, min: 0 },
    fragranceNotes: { type: FragranceNotesSchema, required: false },

    image: { type: String, required: true },
    images: [{ type: String }],

    inStock: { type: Number, default: 0, min: 0 },

    totalSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    ratings: {
      type: [RatingSchema],
      default: [],
    },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },

    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: {
      type: [CommentSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const ProductModel =
  mongoose.models.Product ||
  mongoose.model<ProductType>("Product", ProductSchema);
