import mongoose from "mongoose";

// ✅ mock ProductService BEFORE importing controller
const serviceMock = {
  createProduct: jest.fn(),
  getProductById: jest.fn(),
  getAllProducts: jest.fn(),
  getProductsByCategory: jest.fn(),
  getRecentlyAdded: jest.fn(),
  getTrending: jest.fn(),
  getMostPopular: jest.fn(),
  getTopRated: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  restockProduct: jest.fn(),
  getOutOfStockProducts: jest.fn(),
  incrementViewCount: jest.fn(),
  rateProduct: jest.fn(),
  toggleFavorite: jest.fn(),
  addComment: jest.fn(),
  getUserFavorites: jest.fn(),
  getProductComments: jest.fn(),
};

jest.mock("../../../services/product.service", () => ({
  ProductService: jest.fn().mockImplementation(() => serviceMock),
}));

// ✅ mock DTOs used for validation (so we can force success/fail)
jest.mock("../../../dtos/product.dto", () => ({
  CreateProductDto: { safeParse: jest.fn() },
  UpdateProductDto: { safeParse: jest.fn() },
  RestockProductDto: { safeParse: jest.fn() },
  RateProductDto: { safeParse: jest.fn() },
  AddCommentDto: { safeParse: jest.fn() },
}));

// ✅ mock z.prettifyError so controller can call it safely
jest.mock("zod", () => ({
  __esModule: true,
  default: {
    prettifyError: jest.fn(() => "pretty-error"),
  },
}));

import { ProductController } from "../../../controllers/product.controller";
import {
  CreateProductDto,
  UpdateProductDto,
  RestockProductDto,
  RateProductDto,
  AddCommentDto,
} from "../../../dtos/product.dto";

type MockRes = {
  status: jest.Mock;
  json: jest.Mock;
};

function makeRes(): MockRes {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("ProductController (unit)", () => {
  let controller: ProductController;

  beforeEach(() => {
    controller = new ProductController();
    jest.clearAllMocks();
  });

  // ---------------- createProduct ----------------
  it("createProduct -> 401 if no adminId", async () => {
    const req: any = { user: undefined, body: {}, files: [] };
    const res = makeRes();

    await controller.createProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized",
    });
  });

  it("createProduct -> 400 if body validation fails", async () => {
    (CreateProductDto.safeParse as jest.Mock).mockReturnValue({
      success: false,
      error: { issues: [] },
    });

    const req: any = {
      user: { _id: "admin1" },
      body: {},
      files: [{ filename: "a.png" }],
    };
    const res = makeRes();

    await controller.createProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "pretty-error",
    });
  });

  it("createProduct -> 400 if no files", async () => {
    (CreateProductDto.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { name: "x" },
    });

    const req: any = { user: { _id: "admin1" }, body: {}, files: [] };
    const res = makeRes();

    await controller.createProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Image is required",
    });
  });

  it("createProduct -> 201 success and sets image/images paths", async () => {
    (CreateProductDto.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { name: "Milk" },
    });

    serviceMock.createProduct.mockResolvedValue({ _id: "p1" });

    const req: any = {
      user: { _id: "admin1" },
      body: { name: "Milk" },
      files: [{ filename: "a.png" }, { filename: "b.png" }],
    };
    const res = makeRes();

    await controller.createProduct(req, res as any);

    expect(serviceMock.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Milk",
        image: "/uploads/a.png",
        images: ["/uploads/a.png", "/uploads/b.png"],
      }),
      "admin1",
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product created successfully",
      }),
    );
  });

  // ---------------- getProductById ----------------
  it("getProductById -> 200 success and passes userId if present", async () => {
    serviceMock.getProductById.mockResolvedValue({ _id: "p1" });

    const req: any = { params: { id: "p1" }, user: { _id: "u1" } };
    const res = makeRes();

    await controller.getProductById(req, res as any);

    expect(serviceMock.getProductById).toHaveBeenCalledWith("p1", "u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ---------------- getAllProducts ----------------
  it("getAllProducts -> 200 success", async () => {
    serviceMock.getAllProducts.mockResolvedValue({ products: [], total: 0 });

    const req: any = {
      query: { page: "1", size: "10", search: "mi", category: "Dairy" },
    };
    const res = makeRes();

    await controller.getAllProducts(req, res as any);

    expect(serviceMock.getAllProducts).toHaveBeenCalledWith({
      page: "1",
      size: "10",
      search: "mi",
      category: "Dairy",
    });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ---------------- updateProduct ----------------
  it("updateProduct -> 400 if existingImages is invalid JSON", async () => {
    const req: any = {
      params: { id: "p1" },
      body: { existingImages: "{bad" },
      files: [],
    };
    const res = makeRes();

    await controller.updateProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "existingImages must be valid JSON",
    });
  });

  it("updateProduct -> 400 if UpdateProductDto validation fails", async () => {
    (UpdateProductDto.safeParse as jest.Mock).mockReturnValue({
      success: false,
      error: { issues: [] },
    });

    const req: any = { params: { id: "p1" }, body: {}, files: [] };
    const res = makeRes();

    await controller.updateProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "pretty-error",
    });
  });

  it("updateProduct -> 200 success and merges new uploaded images", async () => {
    (UpdateProductDto.safeParse as jest.Mock).mockImplementation(
      (body: any) => ({
        success: true,
        data: { ...body, existingImages: body.existingImages ?? [] },
      }),
    );

    serviceMock.updateProduct.mockResolvedValue({ _id: "p1", ok: true });

    const req: any = {
      params: { id: "p1" },
      body: { existingImages: JSON.stringify(["/uploads/old.png"]) },
      files: [{ filename: "new1.png" }, { filename: "new2.png" }],
    };
    const res = makeRes();

    await controller.updateProduct(req, res as any);

    expect(serviceMock.updateProduct).toHaveBeenCalledWith("p1", {
      existingImages: [
        "/uploads/old.png",
        "/uploads/new1.png",
        "/uploads/new2.png",
      ],
    });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ---------------- restockProduct ----------------
  it("restockProduct -> 401 if no adminId", async () => {
    const req: any = { user: undefined, params: { id: "p1" }, body: {} };
    const res = makeRes();

    await controller.restockProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("restockProduct -> 400 if invalid product id", async () => {
    const req: any = {
      user: { _id: "admin1" },
      params: { id: "bad-id" },
      body: {},
    };
    const res = makeRes();

    await controller.restockProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid product id",
    });
  });

  it("restockProduct -> 400 if RestockProductDto fails", async () => {
    (RestockProductDto.safeParse as jest.Mock).mockReturnValue({
      success: false,
      error: { issues: [] },
    });

    const validId = new mongoose.Types.ObjectId().toString();
    const req: any = {
      user: { _id: "admin1" },
      params: { id: validId },
      body: {},
    };
    const res = makeRes();

    await controller.restockProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "pretty-error",
    });
  });

  // ---------------- incrementViewCount ----------------
  it("incrementViewCount -> 400 if invalid product id", async () => {
    const req: any = { params: { id: "bad-id" } };
    const res = makeRes();

    await controller.incrementViewCount(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid product id",
    });
  });

  // ---------------- rateProduct ----------------
  it("rateProduct -> 401 if no user", async () => {
    const req: any = { user: undefined, params: { id: "p1" }, body: {} };
    const res = makeRes();

    await controller.rateProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rateProduct -> 400 if invalid product id", async () => {
    const req: any = {
      user: { _id: "u1" },
      params: { id: "bad-id" },
      body: { rating: 5 },
    };
    const res = makeRes();

    await controller.rateProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rateProduct -> 400 if RateProductDto fails", async () => {
    (RateProductDto.safeParse as jest.Mock).mockReturnValue({
      success: false,
      error: { issues: [] },
    });

    const validId = new mongoose.Types.ObjectId().toString();
    const req: any = {
      user: { _id: "u1" },
      params: { id: validId },
      body: { rating: 6 },
    };
    const res = makeRes();

    await controller.rateProduct(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "pretty-error",
    });
  });

  it("rateProduct -> 200 success", async () => {
    (RateProductDto.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { rating: 5 },
    });

    serviceMock.rateProduct.mockResolvedValue({ _id: "p1", averageRating: 5 });

    const validId = new mongoose.Types.ObjectId().toString();
    const req: any = {
      user: { _id: "u1" },
      params: { id: validId },
      body: { rating: 5 },
    };
    const res = makeRes();

    await controller.rateProduct(req, res as any);

    expect(serviceMock.rateProduct).toHaveBeenCalledWith(validId, "u1", 5);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ---------------- addComment ----------------
  it("addComment -> 201 success", async () => {
    (AddCommentDto.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { comment: "nice" },
    });

    serviceMock.addComment.mockResolvedValue({ _id: "p1" });

    const validId = new mongoose.Types.ObjectId().toString();
    const req: any = {
      user: { _id: "u1" },
      params: { id: validId },
      body: { comment: "nice" },
    };
    const res = makeRes();

    await controller.addComment(req, res as any);

    expect(serviceMock.addComment).toHaveBeenCalledWith(validId, "u1", "nice");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // ---------------- toggleFavorite ----------------
  it("toggleFavorite -> 200 success", async () => {
    serviceMock.toggleFavorite.mockResolvedValue({ _id: "p1" });

    const validId = new mongoose.Types.ObjectId().toString();
    const req: any = { user: { _id: "u1" }, params: { id: validId } };
    const res = makeRes();

    await controller.toggleFavorite(req, res as any);

    expect(serviceMock.toggleFavorite).toHaveBeenCalledWith(validId, "u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getProductComments -> 400 invalid id", async () => {
    const req: any = { params: { id: "bad-id" } };
    const res = makeRes();

    await controller.getProductComments(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid product id",
    });
  });

  // ---------------- error path ----------------
  it("should return error.statusCode if service throws", async () => {
    serviceMock.getAllProducts.mockRejectedValue({
      statusCode: 503,
      message: "Service down",
    });

    const req: any = { query: {} };
    const res = makeRes();

    await controller.getAllProducts(req, res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Service down",
    });
  });
});
