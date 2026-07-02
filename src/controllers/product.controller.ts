import { Request, Response } from "express";
import z from "zod";
import { ProductService } from "../services/product.service";
import {
  CreateProductDto,
  RestockProductDto,
  UpdateProductDto,
  RateProductDto,
  AddCommentDto,
} from "../dtos/product.dto";
import mongoose from "mongoose";

const productService = new ProductService();

interface QueryParams {
  page?: string;
  size?: string;
  search?: string;
  category?: string;
}

export class ProductController {
  // ---------------- CREATE (ADMIN ONLY) ----------------
  async createProduct(req: Request, res: Response) {
    try {
      const adminId = req.user?._id;
      if (!adminId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const parsedData = CreateProductDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsedData.error),
        });
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Image is required" });
      }

      parsedData.data.image = `/uploads/${files[0].filename}`;
      parsedData.data.images = files.map((f) => `/uploads/${f.filename}`);

      const product = await productService.createProduct(
        parsedData.data,
        adminId,
      );

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ---------------- READ ----------------
  async getProductById(req: Request, res: Response) {
    try {
      const productId = req.params.id;

      const userId = req.user?._id?.toString(); // may be undefined

      const product = await productService.getProductById(productId, userId);

      return res.status(200).json({
        success: true,
        message: "Product fetched successfully",
        data: product,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async getAllProducts(req: Request, res: Response) {
    try {
      const { page, size, search, category }: QueryParams = req.query;

      const products = await productService.getAllProducts({
        page,
        size,
        search,
        category,
      });

      return res.status(200).json({
        success: true,
        message: "Products fetched successfully",
        data: products,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async getProductsByCategory(req: Request, res: Response) {
    try {
      const products = await productService.getProductsByCategory(
        req.params.category,
      );

      return res.status(200).json({
        success: true,
        message: "Products fetched successfully",
        data: products,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // recently added
  async getRecentlyAdded(req: Request, res: Response) {
    try {
      const page = Number(req.query.page ?? 1);
      const size = Number(req.query.size ?? 10);

      const result = await productService.getRecentlyAdded(page, size);

      return res.status(200).json({
        success: true,
        message: "Recently added products fetched successfully",
        data: result.products,
        pagination: {
          page,
          size,
          total: result.total,
          totalPages: Math.ceil(result.total / size),
        },
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // trending
  async getTrending(req: Request, res: Response) {
    try {
      const page = Number(req.query.page ?? 1);
      const size = Number(req.query.size ?? 10);

      const result = await productService.getTrending(page, size);

      return res.status(200).json({
        success: true,
        message: "Trending products fetched successfully",
        data: result.products,
        pagination: {
          page,
          size,
          total: result.total,
          totalPages: Math.ceil(result.total / size),
        },
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // popular
  async getMostPopular(req: Request, res: Response) {
    try {
      const page = Number(req.query.page ?? 1);
      const size = Number(req.query.size ?? 10);

      const result = await productService.getMostPopular(page, size);

      return res.status(200).json({
        success: true,
        message: "Popular products fetched successfully",
        data: result.products,
        pagination: {
          page,
          size,
          total: result.total,
          totalPages: Math.ceil(result.total / size),
        },
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // top rated
  async getTopRated(req: Request, res: Response) {
    try {
      const page = Number(req.query.page ?? 1);
      const size = Number(req.query.size ?? 10);

      const result = await productService.getTopRated(page, size);

      return res.status(200).json({
        success: true,
        message: "Top rated products fetched successfully",
        data: result.products,
        pagination: {
          page,
          size,
          total: result.total,
          totalPages: Math.ceil(result.total / size),
        },
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ---------------- UPDATE (ADMIN) ----------------
  async updateProduct(req: Request, res: Response) {
    try {
      const productId = req.params.id;

      const body: any = { ...req.body };

      if (typeof body.existingImages === "string") {
        try {
          body.existingImages = JSON.parse(body.existingImages);
        } catch {
          return res.status(400).json({
            success: false,
            message: "existingImages must be valid JSON",
          });
        }
      }

      const parsedData = UpdateProductDto.safeParse(body);
      if (!parsedData.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsedData.error),
        });
      }

      const files = (req as any).files as Express.Multer.File[] | undefined;

      if (files?.length) {
        const newImages = files.map((f) => `/uploads/${f.filename}`);
        parsedData.data.existingImages = [
          ...(Array.isArray(parsedData.data.existingImages)
            ? parsedData.data.existingImages
            : []),
          ...newImages,
        ];
      }

      const updated = await productService.updateProduct(
        productId,
        parsedData.data,
      );

      return res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ---------------- DELETE (ADMIN ONLY) ----------------
  async deleteProduct(req: Request, res: Response) {
    try {
      const productId = req.params.id;
      const result = await productService.deleteProduct(productId);

      return res.status(200).json({
        success: true,
        message: "Product deleted successfully",
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ---------------- RESTOCK (ADMIN) ----------------
  async restockProduct(req: Request, res: Response) {
    try {
      const adminId = req.user?._id;
      if (!adminId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const productId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product id" });
      }

      const parsed = RestockProductDto.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsed.error),
        });
      }

      const updated = await productService.restockProduct(
        productId,
        parsed.data,
      );

      return res.status(200).json({
        success: true,
        message: "Product restocked successfully",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ---------------- OUT OF STOCK ----------------
  async getOutOfStockProducts(req: Request, res: Response) {
    try {
      const { page, size, search, category }: QueryParams = req.query;

      const result = await productService.getOutOfStockProducts({
        page,
        size,
        search,
        category,
      });

      return res.status(200).json({
        success: true,
        message: "Out of stock products fetched successfully",
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ---------------- VIEW COUNT (PUBLIC) ----------------
  async incrementViewCount(req: Request, res: Response) {
    try {
      const productId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product id" });
      }

      const updated = await productService.incrementViewCount(productId);

      return res.status(200).json({
        success: true,
        message: "View count incremented",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ======================================================
  // ✅ NEW: RATING / FAVORITE / COMMENT (USER)
  // ======================================================

  // ⭐ Rate product (body: { rating: 1..5 })
  async rateProduct(req: Request, res: Response) {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const productId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product id" });
      }

      const parsed = RateProductDto.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsed.error),
        });
      }

      const updated = await productService.rateProduct(
        productId,
        userId.toString(),
        parsed.data.rating,
      );

      return res.status(200).json({
        success: true,
        message: "Product rated successfully",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // ❤️ Toggle favorite (no body needed)
  async toggleFavorite(req: Request, res: Response) {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const productId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product id" });
      }

      const updated = await productService.toggleFavorite(
        productId,
        userId.toString(),
      );

      return res.status(200).json({
        success: true,
        message: "Favorite updated successfully",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  // 💬 Add comment (body: { comment: "..." })
  async addComment(req: Request, res: Response) {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const productId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product id" });
      }

      const parsed = AddCommentDto.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsed.error),
        });
      }

      const updated = await productService.addComment(
        productId,
        userId.toString(),
        parsed.data.comment,
      );

      return res.status(201).json({
        success: true,
        message: "Comment added successfully",
        data: updated,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
  // ---------------- USER FAVORITES ----------------
  async getUserFavorites(req: Request, res: Response) {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const products = await productService.getUserFavorites(userId.toString());

      return res.status(200).json({
        success: true,
        message: "Favorite products fetched successfully",
        data: products,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
  // ---------------- GET COMMENTS (PUBLIC) ----------------
  async getProductComments(req: Request, res: Response) {
    try {
      const productId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product id",
        });
      }

      const comments = await productService.getProductComments(productId);

      return res.status(200).json({
        success: true,
        message: "Comments fetched successfully",
        data: comments,
      });
    } catch (error: any) {
      return res.status(error.statusCode ?? 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
}
