import { HttpError } from "../../../errors/http-error";
import { ProductService } from "../../../services/product.service";
import { UserModel } from "../../../models/user.model";

// ✅ Mock repo module ONCE
jest.mock("../../../repositories/product.repository", () => {
  const repo = {
    getProductByName: jest.fn(),
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
    rateProduct: jest.fn(),
    toggleFavorite: jest.fn(),
    addComment: jest.fn(),
    getUserFavorites: jest.fn(),
    getProductComments: jest.fn(),
  };

  return {
    ProductRepository: jest.fn(() => repo),
    __mockRepo: repo, // 👈 export the SAME instance ProductService will use
  };
});

// ✅ Mock notification module ONCE
jest.mock("../../../services/notification.service", () => {
  const notifier = {
    notify: jest.fn(),
  };

  return {
    NotificationService: jest.fn(() => notifier),
    __mockNotify: notifier, // 👈 export same instance
  };
});

// ✅ Mock UserModel ONCE
jest.mock("../../../models/user.model", () => ({
  UserModel: {
    find: jest.fn(),
  },
}));

// 👇 pull the real mock instances used by ProductService
const { __mockRepo: mockRepo } = jest.requireMock(
  "../../../repositories/product.repository",
) as any;

const { __mockNotify: mockNotify } = jest.requireMock(
  "../../../services/notification.service",
) as any;

describe("ProductService", () => {
  let service: ProductService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductService();
  });

  describe("createProduct", () => {
    it("should throw 409 if product name already exists", async () => {
      mockRepo.getProductByName.mockResolvedValue({ _id: "p1", name: "Milk" });

      await expect(
        service.createProduct({ name: "Milk" } as any, "admin1"),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(mockRepo.getProductByName).toHaveBeenCalledWith("Milk");
      expect(mockRepo.createProduct).not.toHaveBeenCalled();
    });

    it("should create product and notify all users", async () => {
      mockRepo.getProductByName.mockResolvedValue(null);

      const newProduct = { _id: "prod123", name: "Chocolate" };
      mockRepo.createProduct.mockResolvedValue(newProduct);

      (UserModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: "u1" }, { _id: "u2" }]),
      });

      mockNotify.notify.mockResolvedValue(true);

      const result = await service.createProduct(
        { name: "Chocolate" } as any,
        "admin99",
      );

      expect(result).toEqual(newProduct);
      expect(mockNotify.notify).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------- READ (getProductById) ----------------
  describe("getProductById", () => {
    it("should throw 404 if product not found", async () => {
      mockRepo.getProductById.mockResolvedValue(null);

      await expect(service.getProductById("p404")).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(mockRepo.getProductById).toHaveBeenCalledWith("p404");
    });

    it("should return mapped product (favorites/comments/ratings) with userId favorite true", async () => {
      const productDoc = {
        toObject: () => ({
          _id: "p1",
          name: "Milk",
          favorites: ["user1", "user2"],
          comments: [
            {
              _id: "c1",
              userId: { _id: "user1", username: "miraj" },
              comment: "Nice",
              createdAt: new Date("2026-03-01T00:00:00.000Z"),
            },
            {
              _id: "c2",
              userId: "user3",
              comment: "ok",
              createdAt: null,
            },
          ],
          ratings: [
            { userId: { _id: "user2", username: "sam" }, rating: 5 },
            { userId: "user9", rating: 3 },
          ],
        }),
      };

      mockRepo.getProductById.mockResolvedValue(productDoc);

      const result = await service.getProductById("p1", "user1");

      expect(result.isFavorite).toBe(true);

      expect(result.comments).toEqual([
        expect.objectContaining({
          _id: "c1",
          userId: "user1",
          username: "miraj",
          comment: "Nice",
        }),
        expect.objectContaining({
          _id: "c2",
          userId: "user3",
          username: "",
          comment: "ok",
        }),
      ]);

      expect(result.ratings).toEqual([
        expect.objectContaining({
          userId: "user2",
          username: "sam",
          rating: 5,
        }),
        expect.objectContaining({ userId: "user9", username: "", rating: 3 }),
      ]);
    });

    it("should return isFavorite false when userId is not provided", async () => {
      mockRepo.getProductById.mockResolvedValue({
        toObject: () => ({ _id: "p1", favorites: ["user1"] }),
      });

      const result = await service.getProductById("p1");
      expect(result.isFavorite).toBe(false);
    });
  });

  // ---------------- getAllProducts ----------------
  describe("getAllProducts", () => {
    it("should normalize category 'All' to '' and compute pagination", async () => {
      mockRepo.getAllProducts.mockResolvedValue({
        products: [{ _id: "p1" }],
        total: 21,
      });

      const res = await service.getAllProducts({
        page: "2",
        size: "10",
        search: "  milk ",
        category: "All",
      });

      expect(mockRepo.getAllProducts).toHaveBeenCalledWith({
        page: 2,
        size: 10,
        search: "milk",
        category: "",
      });

      expect(res.pagination).toEqual({
        page: 2,
        size: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it("should treat size='all' as MAX_SAFE_INTEGER", async () => {
      mockRepo.getAllProducts.mockResolvedValue({ products: [], total: 0 });

      const res = await service.getAllProducts({ size: "all" });

      expect(res.pagination.size).toBe(Number.MAX_SAFE_INTEGER);
      expect(res.pagination.totalPages).toBe(0);
    });
  });

  // ---------------- getProductsByCategory ----------------
  describe("getProductsByCategory", () => {
    it("should throw 400 if category is empty", async () => {
      await expect(service.getProductsByCategory("   ")).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("should call repository with trimmed category", async () => {
      mockRepo.getProductsByCategory.mockResolvedValue([{ _id: "p1" }]);

      const res = await service.getProductsByCategory("  Drinks ");
      expect(mockRepo.getProductsByCategory).toHaveBeenCalledWith("Drinks");
      expect(res).toEqual([{ _id: "p1" }]);
    });
  });

  // ---------------- UPDATE ----------------
  describe("updateProduct", () => {
    it("should throw 404 if product not found", async () => {
      mockRepo.getProductById.mockResolvedValue(null);

      await expect(
        service.updateProduct("p404", { name: "X" } as any),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(mockRepo.updateProduct).not.toHaveBeenCalled();
    });

    it("should throw 409 if new name duplicates another product", async () => {
      mockRepo.getProductById.mockResolvedValue({ _id: "p1", name: "Old" });
      mockRepo.getProductByName.mockResolvedValue({ _id: "p2", name: "New" });

      await expect(
        service.updateProduct("p1", { name: "New" } as any),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(mockRepo.getProductByName).toHaveBeenCalledWith("New");
      expect(mockRepo.updateProduct).not.toHaveBeenCalled();
    });

    it("should map existingImages -> images and set image to first", async () => {
      mockRepo.getProductById.mockResolvedValue({
        _id: "p1",
        name: "Milk",
        image: "old.jpg",
      });

      const updatedDoc = { _id: "p1", images: ["a.jpg"], image: "a.jpg" };
      mockRepo.updateProduct.mockResolvedValue(updatedDoc);

      const res = await service.updateProduct("p1", {
        existingImages: ["a.jpg", "b.jpg"],
      } as any);

      expect(mockRepo.updateProduct).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({
          images: ["a.jpg", "b.jpg"],
          image: "a.jpg",
        }),
      );

      // existingImages should be removed from update payload
      const callArg = (mockRepo.updateProduct as jest.Mock).mock.calls[0][1];
      expect(callArg.existingImages).toBeUndefined();

      expect(res).toEqual(updatedDoc);
    });
  });

  // ---------------- DELETE ----------------
  describe("deleteProduct", () => {
    it("should throw 404 if delete fails", async () => {
      mockRepo.deleteProduct.mockResolvedValue(false);

      await expect(service.deleteProduct("p1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should return success true when deleted", async () => {
      mockRepo.deleteProduct.mockResolvedValue(true);

      await expect(service.deleteProduct("p1")).resolves.toEqual({
        success: true,
      });
    });
  });

  // ---------------- incrementViewCount ----------------
  describe("incrementViewCount", () => {
    it("should throw 404 if product not found", async () => {
      mockRepo.getProductById.mockResolvedValue(null);

      await expect(service.incrementViewCount("p1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should update viewCount by +1", async () => {
      mockRepo.getProductById.mockResolvedValue({ _id: "p1", viewCount: 7 });
      mockRepo.updateProduct.mockResolvedValue({ _id: "p1", viewCount: 8 });

      const res = await service.incrementViewCount("p1");

      expect(mockRepo.updateProduct).toHaveBeenCalledWith("p1", {
        viewCount: 8,
      });
      expect(res).toEqual({ _id: "p1", viewCount: 8 });
    });
  });

  // ---------------- restockProduct ----------------
  describe("restockProduct", () => {
    it("should throw 400 for invalid quantity", async () => {
      await expect(
        service.restockProduct("p1", { quantity: -1 }),
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        service.restockProduct("p1", { quantity: Number.NaN }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("should set stock when mode='set' (default)", async () => {
      mockRepo.getProductById.mockResolvedValue({ _id: "p1", inStock: 5 });
      mockRepo.updateProduct.mockResolvedValue({ _id: "p1", inStock: 12 });

      const res = await service.restockProduct("p1", { quantity: 12 });

      expect(mockRepo.updateProduct).toHaveBeenCalledWith("p1", {
        inStock: 12,
      });
      expect(res.inStock).toBe(12);
    });

    it("should add stock when mode='add'", async () => {
      mockRepo.getProductById.mockResolvedValue({ _id: "p1", inStock: 5 });
      mockRepo.updateProduct.mockResolvedValue({ _id: "p1", inStock: 9 });

      const res = await service.restockProduct("p1", {
        quantity: 4,
        mode: "add",
      });

      expect(mockRepo.updateProduct).toHaveBeenCalledWith("p1", {
        inStock: 9,
      });
      expect(res.inStock).toBe(9);
    });

    it("should throw 404 if product not found", async () => {
      mockRepo.getProductById.mockResolvedValue(null);

      await expect(
        service.restockProduct("p404", { quantity: 3 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ---------------- rateProduct ----------------
  describe("rateProduct", () => {
    it("should throw 400 if rating not between 1 and 5", async () => {
      await expect(service.rateProduct("p1", "u1", 0)).rejects.toMatchObject({
        statusCode: 400,
      });
      await expect(service.rateProduct("p1", "u1", 6)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("should call repository and return updated", async () => {
      mockRepo.rateProduct.mockResolvedValue({ _id: "p1", averageRating: 4.5 });

      const res = await service.rateProduct("p1", "u1", 5);

      expect(mockRepo.rateProduct).toHaveBeenCalledWith({
        productId: "p1",
        userId: "u1",
        rating: 5,
      });

      expect(res).toEqual({ _id: "p1", averageRating: 4.5 });
    });

    it("should throw 404 if repo returns null", async () => {
      mockRepo.rateProduct.mockResolvedValue(null);

      await expect(service.rateProduct("p1", "u1", 5)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ---------------- toggleFavorite ----------------
  describe("toggleFavorite", () => {
    it("should throw 404 if repo returns null", async () => {
      mockRepo.toggleFavorite.mockResolvedValue(null);

      await expect(service.toggleFavorite("p1", "u1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should return updated when ok", async () => {
      mockRepo.toggleFavorite.mockResolvedValue({
        _id: "p1",
        favorites: ["u1"],
      });

      await expect(service.toggleFavorite("p1", "u1")).resolves.toEqual({
        _id: "p1",
        favorites: ["u1"],
      });
    });
  });

  // ---------------- addComment ----------------
  describe("addComment", () => {
    it("should throw 400 if comment is empty", async () => {
      await expect(service.addComment("p1", "u1", "   ")).rejects.toMatchObject(
        { statusCode: 400 },
      );
    });

    it("should trim comment and call repo", async () => {
      mockRepo.addComment.mockResolvedValue({ _id: "p1" });

      await service.addComment("p1", "u1", "  hello  ");

      expect(mockRepo.addComment).toHaveBeenCalledWith({
        productId: "p1",
        userId: "u1",
        comment: "hello",
      });
    });

    it("should throw 404 if repo returns null", async () => {
      mockRepo.addComment.mockResolvedValue(null);

      await expect(
        service.addComment("p1", "u1", "hello"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ---------------- getUserFavorites ----------------
  describe("getUserFavorites", () => {
    it("should throw 401 if userId missing", async () => {
      await expect(service.getUserFavorites("")).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("should call repo and return favorites", async () => {
      mockRepo.getUserFavorites.mockResolvedValue([{ _id: "p1" }]);

      const res = await service.getUserFavorites("u1");
      expect(mockRepo.getUserFavorites).toHaveBeenCalledWith("u1");
      expect(res).toEqual([{ _id: "p1" }]);
    });
  });

  // ---------------- getProductComments ----------------
  describe("getProductComments", () => {
    it("should throw 404 if repo returns null", async () => {
      mockRepo.getProductComments.mockResolvedValue(null);

      await expect(service.getProductComments("p1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should map comments to expected shape", async () => {
      mockRepo.getProductComments.mockResolvedValue([
        {
          _id: "c1",
          userId: { _id: "u1", username: "miraj" },
          comment: "Hi",
          createdAt: new Date(),
        },
        {
          _id: "c2",
          userId: "u2",
          comment: "Yo",
          createdAt: null,
        },
      ]);

      const res = await service.getProductComments("p1");

      expect(res).toEqual([
        expect.objectContaining({
          _id: "c1",
          userId: "u1",
          username: "miraj",
          comment: "Hi",
        }),
        expect.objectContaining({
          _id: "c2",
          userId: "u2",
          username: undefined,
          comment: "Yo",
        }),
      ]);
    });
  });
});
