import { ProductModel, ProductDoc } from "../models/product.model";
import { UserModel } from "../models/user.model";
import type { ProductType } from "../types/product.type";

type ProductQueryArgs = {
  page: number;
  size: number;
  search?: string;
  category?: string;
};

export interface IProductRepository {
  getProductById(id: string): Promise<ProductDoc | null>;
  getAllProducts(
    args: ProductQueryArgs,
  ): Promise<{ products: ProductDoc[]; total: number }>;

  createProduct(productData: Partial<ProductType>): Promise<ProductDoc>;
  updateProduct(
    id: string,
    updateData: Partial<ProductType>,
  ): Promise<ProductDoc | null>;
  deleteProduct(id: string): Promise<boolean>;

  getRecentlyAdded(args: {
    page: number;
    size: number;
  }): Promise<{ products: ProductDoc[]; total: number }>;
  getTrending(args: {
    page: number;
    size: number;
  }): Promise<{ products: ProductDoc[]; total: number }>;
  getMostPopular(args: {
    page: number;
    size: number;
  }): Promise<{ products: ProductDoc[]; total: number }>;
  getTopRated(args: {
    page: number;
    size: number;
  }): Promise<{ products: ProductDoc[]; total: number }>;

  rateProduct(args: {
    productId: string;
    userId: string;
    rating: number;
  }): Promise<ProductDoc | null>;
  toggleFavorite(args: {
    productId: string;
    userId: string;
  }): Promise<ProductDoc | null>;
  addComment(args: {
    productId: string;
    userId: string;
    comment: string;
  }): Promise<ProductDoc | null>;
}

export class ProductRepository implements IProductRepository {
  async createProduct(productData: Partial<ProductType>): Promise<ProductDoc> {
    // ✅ ensure these fields start clean (prevent admin setting them manually)
    const safeData: Partial<ProductType> = {
      ...productData,
      ratings: [],
      favorites: [],
      comments: [],
      averageRating: 0,
      reviewCount: 0,
    };

    return await ProductModel.create(safeData);
  }

  async getProductByName(name: string): Promise<ProductDoc | null> {
    return await ProductModel.findOne({ name });
  }

  async getProductById(id: string): Promise<ProductDoc | null> {
    return await ProductModel.findById(id)
      .populate("comments.userId", "username")
      .populate("ratings.userId", "username");
  }
  async updateProduct(
    id: string,
    updateData: Partial<ProductType>,
  ): Promise<ProductDoc | null> {
    const {
      ratings,
      favorites,
      comments,
      averageRating,
      reviewCount,
      ...safeUpdate
    } = updateData as any;

    return await ProductModel.findByIdAndUpdate(id, safeUpdate, {
      new: true,
    }).populate("comments.userId", "username");
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await ProductModel.findByIdAndDelete(id);
    return !!result;
  }

  async getAllProducts({ page, size, search, category }: ProductQueryArgs) {
    const skip = (page - 1) * size;
    const filter: any = {};

    if (search?.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ];
    }

    if (category?.trim()) {
      filter.category = category.trim();
    }

    const [products, total] = await Promise.all([
      ProductModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      ProductModel.countDocuments(filter),
    ]);

    return { products, total };
  }

  async getProductsByCategory(category: string) {
    const clean = category.trim();
    return ProductModel.find({
      category: { $regex: `^${clean}$`, $options: "i" },
    }).sort({ createdAt: -1 });
  }

  async getRecentlyAdded({ page, size }: { page: number; size: number }) {
    const skip = (page - 1) * size;
    const filter = { inStock: { $gt: 0 } };

    const [products, total] = await Promise.all([
      ProductModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      ProductModel.countDocuments(filter),
    ]);

    return { products, total };
  }

  async getTrending({ page, size }: { page: number; size: number }) {
    const skip = (page - 1) * size;
    const filter = { inStock: { $gt: 0 } };

    const [products, total] = await Promise.all([
      ProductModel.find(filter).sort({ totalSold: -1 }).skip(skip).limit(size),
      ProductModel.countDocuments(filter),
    ]);

    return { products, total };
  }

  async getMostPopular({ page, size }: { page: number; size: number }) {
    const skip = (page - 1) * size;
    const filter = { inStock: { $gt: 0 } };

    const [products, total] = await Promise.all([
      ProductModel.find(filter).sort({ viewCount: -1 }).skip(skip).limit(size),
      ProductModel.countDocuments(filter),
    ]);

    return { products, total };
  }

  async getTopRated({ page, size }: { page: number; size: number }) {
    const skip = (page - 1) * size;
    const filter = { inStock: { $gt: 0 } };

    const [products, total] = await Promise.all([
      ProductModel.find(filter)
        .sort({ averageRating: -1, reviewCount: -1 })
        .skip(skip)
        .limit(size),
      ProductModel.countDocuments(filter),
    ]);

    return { products, total };
  }

  async rateProduct({
    productId,
    userId,
    rating,
  }: {
    productId: string;
    userId: string;
    rating: number;
  }): Promise<ProductDoc | null> {
    const product = await ProductModel.findById(productId);
    if (!product) return null;

    // if user already rated -> update it, else push new
    const existing = product.ratings?.find(
      (r: any) => String(r.userId) === String(userId),
    );
    if (existing) {
      existing.rating = rating;
    } else {
      product.ratings = product.ratings || [];
      product.ratings.push({ userId, rating } as any);
    }

    // recompute average + count
    const total = product.ratings.reduce(
      (sum: number, r: any) => sum + Number(r.rating || 0),
      0,
    );
    product.reviewCount = product.ratings.length;
    product.averageRating =
      product.reviewCount === 0
        ? 0
        : Number((total / product.reviewCount).toFixed(2));

    await product.save();
    return product;
  }

  async toggleFavorite({
    productId,
    userId,
  }: {
    productId: string;
    userId: string;
  }): Promise<ProductDoc | null> {
    const product = await ProductModel.findById(productId);
    if (!product) return null;

    product.favorites = product.favorites || [];

    const idx = product.favorites.findIndex(
      (id: any) => String(id) === String(userId),
    );
    if (idx >= 0) product.favorites.splice(idx, 1);
    else product.favorites.push(userId as any);

    await product.save();
    return product;
  }

  async addComment({
    productId,
    userId,
    comment,
  }: {
    productId: string;
    userId: string;
    comment: string;
  }): Promise<ProductDoc | null> {
    const product = await ProductModel.findById(productId);
    if (!product) return null;

    product.comments = product.comments || [];

    product.comments.push({
      userId,
      comment,
    } as any);

    await product.save();

    // return populated version
    return await ProductModel.findById(productId)
      .populate("comments.userId", "username")
      .populate("ratings.userId", "username");
  }
  async getUserFavorites(userId: string) {
    return ProductModel.find({
      favorites: userId,
    }).sort({ createdAt: -1 });
  }
  async getProductComments(productId: string) {
    const product = await ProductModel.findById(productId)
      .select("comments")
      .populate("comments.userId", "username");
    return product?.comments;
  }
}
