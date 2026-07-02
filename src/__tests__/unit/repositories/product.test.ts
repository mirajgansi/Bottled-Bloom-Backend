import { ProductRepository } from "../../../repositories/product.repository";
import { ProductModel } from "../../../models/product.model";

// ✅ mock ProductModel only (we’re unit testing repository logic)
jest.mock("../../../models/product.model", () => ({
  ProductModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

describe("ProductRepository (unit)", () => {
  let repo: ProductRepository;

  beforeEach(() => {
    repo = new ProductRepository();
    jest.clearAllMocks();
  });

  it("createProduct should force safe fields (ratings/favorites/comments/avg/count)", async () => {
    (ProductModel.create as jest.Mock).mockResolvedValue({ _id: "p1" });

    await repo.createProduct({
      name: "A",
      averageRating: 99, // should be overwritten
      reviewCount: 99, // should be overwritten
      ratings: [{ userId: "x", rating: 5 }], // should be overwritten
    } as any);

    expect(ProductModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "A",
        ratings: [],
        favorites: [],
        comments: [],
        averageRating: 0,
        reviewCount: 0,
      }),
    );
  });

  it("getProductByName should call findOne", async () => {
    (ProductModel.findOne as jest.Mock).mockResolvedValue({ _id: "p1" });

    const res = await repo.getProductByName("Milk");

    expect(ProductModel.findOne).toHaveBeenCalledWith({ name: "Milk" });
    expect(res).toEqual({ _id: "p1" });
  });

  it("getProductById should populate comments.userId and ratings.userId", async () => {
    const populate2 = jest.fn().mockResolvedValue({ _id: "p1" });
    const populate1 = jest.fn().mockReturnValue({ populate: populate2 });

    (ProductModel.findById as jest.Mock).mockReturnValue({
      populate: populate1,
    });

    const res = await repo.getProductById("p1");

    expect(ProductModel.findById).toHaveBeenCalledWith("p1");
    expect(populate1).toHaveBeenCalledWith("comments.userId", "username");
    expect(populate2).toHaveBeenCalledWith("ratings.userId", "username");
    expect(res).toEqual({ _id: "p1" });
  });

  it("updateProduct should strip unsafe fields before updating", async () => {
    const populated = jest.fn().mockResolvedValue({ _id: "p1", name: "new" });

    (ProductModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
      populate: populated,
    });

    const res = await repo.updateProduct("p1", {
      name: "new",
      ratings: [{ userId: "u", rating: 5 }], // should be stripped
      favorites: ["u"], // stripped
      comments: [], // stripped
      averageRating: 5, // stripped
      reviewCount: 2, // stripped
    } as any);

    expect(ProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "p1",
      { name: "new" }, // ✅ only safe fields
      { new: true },
    );
    expect(populated).toHaveBeenCalledWith("comments.userId", "username");
    expect(res).toEqual({ _id: "p1", name: "new" });
  });

  it("deleteProduct should return true when doc deleted", async () => {
    (ProductModel.findByIdAndDelete as jest.Mock).mockResolvedValue({
      _id: "p1",
    });

    const res = await repo.deleteProduct("p1");

    expect(ProductModel.findByIdAndDelete).toHaveBeenCalledWith("p1");
    expect(res).toBe(true);
  });

  it("deleteProduct should return false when nothing deleted", async () => {
    (ProductModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

    const res = await repo.deleteProduct("p1");

    expect(res).toBe(false);
  });

  it("getAllProducts should search by name/category and paginate + count", async () => {
    const limitMock = jest.fn().mockResolvedValue([{ _id: "p1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (ProductModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (ProductModel.countDocuments as jest.Mock).mockResolvedValue(7);

    const res = await repo.getAllProducts({
      page: 2,
      size: 5,
      search: "mi",
      category: "Dairy",
    });

    // filter includes BOTH search $or and category exact
    expect(ProductModel.find).toHaveBeenCalledWith({
      $or: [
        { name: { $regex: "mi", $options: "i" } },
        { category: { $regex: "mi", $options: "i" } },
      ],
      category: "Dairy",
    });

    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skipMock).toHaveBeenCalledWith((2 - 1) * 5);
    expect(limitMock).toHaveBeenCalledWith(5);
    expect(ProductModel.countDocuments).toHaveBeenCalled();
    expect(res).toEqual({ products: [{ _id: "p1" }], total: 7 });
  });

  it("getProductsByCategory should build case-insensitive exact regex and sort", async () => {
    const sortMock = jest.fn().mockResolvedValue([{ _id: "p1" }]);
    (ProductModel.find as jest.Mock).mockReturnValue({ sort: sortMock });

    const res = await repo.getProductsByCategory("  Dairy  ");

    expect(ProductModel.find).toHaveBeenCalledWith({
      category: { $regex: "^Dairy$", $options: "i" },
    });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res).toEqual([{ _id: "p1" }]);
  });

  it("getRecentlyAdded should filter inStock>0 and sort createdAt desc", async () => {
    const limitMock = jest.fn().mockResolvedValue([{ _id: "p1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (ProductModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (ProductModel.countDocuments as jest.Mock).mockResolvedValue(2);

    const res = await repo.getRecentlyAdded({ page: 1, size: 10 });

    expect(ProductModel.find).toHaveBeenCalledWith({ inStock: { $gt: 0 } });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.total).toBe(2);
  });

  it("getTrending should sort by totalSold desc", async () => {
    const limitMock = jest.fn().mockResolvedValue([{ _id: "p1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (ProductModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (ProductModel.countDocuments as jest.Mock).mockResolvedValue(2);

    await repo.getTrending({ page: 1, size: 10 });

    expect(ProductModel.find).toHaveBeenCalledWith({ inStock: { $gt: 0 } });
    expect(sortMock).toHaveBeenCalledWith({ totalSold: -1 });
  });

  it("getMostPopular should sort by viewCount desc", async () => {
    const limitMock = jest.fn().mockResolvedValue([{ _id: "p1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (ProductModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (ProductModel.countDocuments as jest.Mock).mockResolvedValue(2);

    await repo.getMostPopular({ page: 1, size: 10 });

    expect(sortMock).toHaveBeenCalledWith({ viewCount: -1 });
  });

  it("getTopRated should sort by averageRating desc then reviewCount desc", async () => {
    const limitMock = jest.fn().mockResolvedValue([{ _id: "p1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (ProductModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (ProductModel.countDocuments as jest.Mock).mockResolvedValue(2);

    await repo.getTopRated({ page: 1, size: 10 });

    expect(sortMock).toHaveBeenCalledWith({
      averageRating: -1,
      reviewCount: -1,
    });
  });

  it("rateProduct should return null if product not found", async () => {
    (ProductModel.findById as jest.Mock).mockResolvedValue(null);

    const res = await repo.rateProduct({
      productId: "p1",
      userId: "u1",
      rating: 4,
    });

    expect(res).toBeNull();
  });

  it("rateProduct should add new rating and compute average + reviewCount", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const product: any = {
      _id: "p1",
      ratings: [],
      reviewCount: 0,
      averageRating: 0,
      save: saveMock,
    };

    (ProductModel.findById as jest.Mock).mockResolvedValue(product);

    const res = await repo.rateProduct({
      productId: "p1",
      userId: "u1",
      rating: 4,
    });

    expect(product.ratings.length).toBe(1);
    expect(product.reviewCount).toBe(1);
    expect(product.averageRating).toBe(4);
    expect(saveMock).toHaveBeenCalled();
    expect(res).toBe(product);
  });

  it("rateProduct should update existing rating instead of pushing new", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const product: any = {
      _id: "p1",
      ratings: [{ userId: "u1", rating: 2 }],
      reviewCount: 1,
      averageRating: 2,
      save: saveMock,
    };

    (ProductModel.findById as jest.Mock).mockResolvedValue(product);

    await repo.rateProduct({ productId: "p1", userId: "u1", rating: 5 });

    expect(product.ratings.length).toBe(1); // not added
    expect(product.ratings[0].rating).toBe(5);
    expect(product.reviewCount).toBe(1);
    expect(product.averageRating).toBe(5);
  });

  it("toggleFavorite should return null if product not found", async () => {
    (ProductModel.findById as jest.Mock).mockResolvedValue(null);

    const res = await repo.toggleFavorite({ productId: "p1", userId: "u1" });

    expect(res).toBeNull();
  });

  it("toggleFavorite should add userId if not already favorite", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);
    const product: any = { _id: "p1", favorites: [], save: saveMock };

    (ProductModel.findById as jest.Mock).mockResolvedValue(product);

    await repo.toggleFavorite({ productId: "p1", userId: "u1" });

    expect(product.favorites).toEqual(["u1"]);
    expect(saveMock).toHaveBeenCalled();
  });

  it("toggleFavorite should remove userId if already favorite", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);
    const product: any = { _id: "p1", favorites: ["u1"], save: saveMock };

    (ProductModel.findById as jest.Mock).mockResolvedValue(product);

    await repo.toggleFavorite({ productId: "p1", userId: "u1" });

    expect(product.favorites).toEqual([]);
    expect(saveMock).toHaveBeenCalled();
  });

  it("addComment should return null if product not found", async () => {
    (ProductModel.findById as jest.Mock).mockResolvedValue(null);

    const res = await repo.addComment({
      productId: "p1",
      userId: "u1",
      comment: "hi",
    });

    expect(res).toBeNull();
  });

  it("addComment should push comment, save, and return populated product", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const product: any = { _id: "p1", comments: [], save: saveMock };
    (ProductModel.findById as jest.Mock).mockResolvedValueOnce(product);

    // second findById (return populated chain)
    const populate2 = jest
      .fn()
      .mockResolvedValue({ _id: "p1", populated: true });
    const populate1 = jest.fn().mockReturnValue({ populate: populate2 });
    (ProductModel.findById as jest.Mock).mockReturnValueOnce({
      populate: populate1,
    });

    const res = await repo.addComment({
      productId: "p1",
      userId: "u1",
      comment: "nice",
    });

    expect(product.comments.length).toBe(1);
    expect(saveMock).toHaveBeenCalled();
    expect(populate1).toHaveBeenCalledWith("comments.userId", "username");
    expect(populate2).toHaveBeenCalledWith("ratings.userId", "username");
    expect(res).toEqual({ _id: "p1", populated: true });
  });

  it("getUserFavorites should find favorites and sort by createdAt desc", async () => {
    const sortMock = jest.fn().mockResolvedValue([{ _id: "p1" }]);
    (ProductModel.find as jest.Mock).mockReturnValue({ sort: sortMock });

    const res = await repo.getUserFavorites("u1");

    expect(ProductModel.find).toHaveBeenCalledWith({ favorites: "u1" });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res).toEqual([{ _id: "p1" }]);
  });

  it("getProductComments should select comments and populate username", async () => {
    const populateMock = jest.fn().mockResolvedValue({
      comments: [{ comment: "hi" }],
    });
    const selectMock = jest.fn().mockReturnValue({ populate: populateMock });

    (ProductModel.findById as jest.Mock).mockReturnValue({
      select: selectMock,
    });

    const res = await repo.getProductComments("p1");

    expect(ProductModel.findById).toHaveBeenCalledWith("p1");
    expect(selectMock).toHaveBeenCalledWith("comments");
    expect(populateMock).toHaveBeenCalledWith("comments.userId", "username");
    expect(res).toEqual([{ comment: "hi" }]);
  });
});
