import { HttpError } from "../errors/http-error";
import { ProductRepository } from "../repositories/product.repository";
import { CreateProductDto, UpdateProductDto } from "../dtos/product.dto";
import { UserModel } from "../models/user.model";
import { NotificationService } from "./notification.service";

const productRepository = new ProductRepository();
const notificationService = new NotificationService();

export class ProductService {
  // ---------------- CREATE (ADMIN) ----------------
  async createProduct(data: CreateProductDto, adminId: string) {
    const nameCheck = await productRepository.getProductByName(data.name);
    if (nameCheck) throw new HttpError(409, "Product name already in use");

    const newProduct = await productRepository.createProduct({ ...data });

    const users = await UserModel.find({ role: "user" }).select("_id");

    await Promise.all(
      users.map((u) =>
        notificationService.notify({
          to: u._id.toString(),
          from: adminId,
          type: "product_added",
          title: "New Product Added",
          message: `${newProduct.name} is now available!`,
          data: {
            productId: newProduct._id.toString(),
            url: `/products/${newProduct._id}`,
          },
        }),
      ),
    );

    return newProduct;
  }

  // ---------------- READ ----------------
  async getProductById(productId: string, userId?: string) {
    const product = await productRepository.getProductById(productId);
    if (!product) throw new HttpError(404, "Product not found");

    const p: any = product.toObject();
    p.isFavorite = userId
      ? (p.favorites ?? []).some((id: any) => String(id) === String(userId))
      : false;
    p.comments = (p.comments ?? []).map((c: any) => ({
      _id: c._id,
      userId: c.userId?._id?.toString?.() ?? c.userId?.toString?.() ?? "",
      username: c.userId?.username ?? "",
      comment: c.comment,
      createdAt: c.createdAt,
    }));

    p.ratings = (p.ratings ?? []).map((r: any) => ({
      userId: r.userId?._id?.toString?.() ?? r.userId?.toString?.() ?? "",
      username: r.userId?.username ?? "",
      rating: r.rating,
    }));
    if (!p) throw new HttpError(404, "Product not found");
    return p;
  }
  async getAllProducts({
    page,
    size,
    search,
    category,
  }: {
    page?: string;
    size?: string;
    search?: string;
    category?: string;
  }) {
    const currentPage = page ? parseInt(page) : 1;
    const pageSize =
      size === "all" ? Number.MAX_SAFE_INTEGER : size ? parseInt(size) : 10;

    const currentSearch = (search ?? "").trim();
    const currentCategory = (category ?? "").trim();

    const normalizedCategory =
      !currentCategory || currentCategory === "All" ? "" : currentCategory;

    const { products, total } = await productRepository.getAllProducts({
      page: currentPage,
      size: pageSize,
      search: currentSearch,
      category: normalizedCategory,
    });

    const pagination = {
      page: currentPage,
      size: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };

    return { products, pagination };
  }

  async getProductsByCategory(category: string) {
    const clean = category?.trim();
    if (!clean) throw new HttpError(400, "Category is required");
    return productRepository.getProductsByCategory(clean);
  }

  // recently added
  async getRecentlyAdded(page: number = 1, size: number = 10) {
    return productRepository.getRecentlyAdded({ page, size });
  }

  // trending = highest selling
  async getTrending(page: number = 1, size: number = 10) {
    return productRepository.getTrending({ page, size });
  }

  // popular = most viewed
  async getMostPopular(page: number = 1, size: number = 10) {
    return productRepository.getMostPopular({ page, size });
  }

  // top rated
  async getTopRated(page: number = 1, size: number = 10) {
    return productRepository.getTopRated({ page, size });
  }

  // ---------------- UPDATE (ADMIN) ----------------
  async updateProduct(productId: string, data: UpdateProductDto) {
    const existing = await productRepository.getProductById(productId);
    if (!existing) throw new HttpError(404, "Product not found");

    // if updating name, check duplicates
    if (data.name && data.name !== existing.name) {
      const nameCheck = await productRepository.getProductByName(data.name);
      if (nameCheck) throw new HttpError(409, "Product name already in use");
    }

    const update: any = { ...data };

    // handle existingImages swap
    if (Array.isArray(data.existingImages)) {
      update.images = data.existingImages;
      update.image = data.existingImages[0] ?? existing.image;
      delete update.existingImages;
    }

    const updated = await productRepository.updateProduct(productId, update);
    if (!updated) throw new HttpError(404, "Product not found");
    return updated;
  }

  // ---------------- DELETE (ADMIN) ----------------
  async deleteProduct(productId: string) {
    const ok = await productRepository.deleteProduct(productId);
    if (!ok) throw new HttpError(404, "Product not found");
    return { success: true };
  }

  // ---------------- analytics helpers ----------------
  async incrementViewCount(productId: string) {
    const product = await productRepository.getProductById(productId);
    if (!product) throw new HttpError(404, "Product not found");

    const updated = await productRepository.updateProduct(productId, {
      viewCount: (product.viewCount ?? 0) + 1,
    } as any);

    if (!updated) throw new HttpError(404, "Product not found");
    return updated;
  }

  async restockProduct(
    productId: string,
    input: { quantity: number; mode?: "set" | "add" },
  ) {
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new HttpError(400, "Quantity must be a valid number (>= 0)");
    }

    const product = await productRepository.getProductById(productId);
    if (!product) throw new HttpError(404, "Product not found");

    const mode = input.mode ?? "set";
    const nextStock =
      mode === "add" ? (product.inStock ?? 0) + quantity : quantity;

    const updated = await productRepository.updateProduct(productId, {
      inStock: nextStock,
    } as any);

    if (!updated) throw new HttpError(404, "Product not found");
    return updated;
  }

  // ---------------- OUT OF STOCK ----------------
  async getOutOfStockProducts({
    page,
    size,
    search,
    category,
  }: {
    page?: string;
    size?: string;
    search?: string;
    category?: string;
  }) {
    const currentPage = page ? parseInt(page) : 1;
    const pageSize =
      size === "all" ? Number.MAX_SAFE_INTEGER : size ? parseInt(size) : 10;

    const currentSearch = (search ?? "").trim();
    const currentCategory = (category ?? "").trim();
    const normalizedCategory =
      !currentCategory || currentCategory === "All" ? "" : currentCategory;

    // ✅ easiest: reuse getAllProducts logic but with out-of-stock filter
    // If you want cleaner, create repository method getOutOfStock(...)
    const { products, total } = await productRepository.getAllProducts({
      page: currentPage,
      size: pageSize,
      search: currentSearch,
      category: normalizedCategory,
    });

    const outOnly = products.filter((p: any) => (p.inStock ?? 0) <= 0);
    const pagination = {
      page: currentPage,
      size: pageSize,
      total, // (optional) if you want correct total for out-of-stock, create repo method
      totalPages: Math.ceil(total / pageSize),
    };

    return { products: outOnly, pagination };
  }

  async rateProduct(productId: string, userId: string, rating: number) {
    if (!rating || rating < 1 || rating > 5) {
      throw new HttpError(400, "Rating must be between 1 and 5");
    }

    const updated = await productRepository.rateProduct({
      productId,
      userId,
      rating,
    });

    if (!updated) throw new HttpError(404, "Product not found");
    return updated;
  }

  async toggleFavorite(productId: string, userId: string) {
    const updated = await productRepository.toggleFavorite({
      productId,
      userId,
    });

    if (!updated) throw new HttpError(404, "Product not found");
    return updated;
  }

  async addComment(productId: string, userId: string, comment: string) {
    const clean = (comment ?? "").trim();
    if (!clean) throw new HttpError(400, "Comment is required");

    const updated = await productRepository.addComment({
      productId,
      userId,
      comment: clean,
    });

    if (!updated) throw new HttpError(404, "Product not found");
    return updated;
  }
  async getUserFavorites(userId: string) {
    if (!userId) {
      throw new HttpError(401, "Unauthorized");
    }

    return productRepository.getUserFavorites(userId);
  }
  async getProductComments(productId: string) {
    const comments = await productRepository.getProductComments(productId);
    if (!comments) throw new HttpError(404, "Product not found");

    return (comments ?? []).map((c: any) => ({
      _id: c._id,
      userId: c.userId?._id?.toString?.() ?? c.userId?.toString?.(),
      username: c.userId?.username,
      comment: c.comment,
      createdAt: c.createdAt,
    }));
  }
}
