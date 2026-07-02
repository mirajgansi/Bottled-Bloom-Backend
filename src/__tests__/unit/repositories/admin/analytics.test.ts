import { OrderModel } from "../../../../models/order.model";
import { ProductModel } from "../../../../models/product.model";
import { AdminAnalyticsRepository } from "../../../../repositories/admin/analytics.repository";

jest.mock("../../../../models/order.model", () => ({
  OrderModel: {
    aggregate: jest.fn(),
  },
}));

jest.mock("../../../../models/product.model", () => ({
  ProductModel: {
    aggregate: jest.fn(),
  },
}));

describe("AdminAnalyticsRepository (unit)", () => {
  let repo: AdminAnalyticsRepository;

  beforeEach(() => {
    repo = new AdminAnalyticsRepository();
    jest.clearAllMocks();
  });

  it("aggregate should call OrderModel.aggregate with pipeline", async () => {
    (OrderModel.aggregate as jest.Mock).mockResolvedValue([{ ok: true }]);

    const pipeline: any[] = [{ $match: { status: "delivered" } }];

    const res = await repo.aggregate(pipeline);

    expect(OrderModel.aggregate).toHaveBeenCalledWith(pipeline);
    expect(res).toEqual([{ ok: true }]);
  });

  it("aggregateFromCollection(products) should call ProductModel.aggregate", async () => {
    (ProductModel.aggregate as jest.Mock).mockResolvedValue([
      { productCount: 10 },
    ]);

    const pipeline: any[] = [{ $group: { _id: null, c: { $sum: 1 } } }];

    const res = await repo.aggregateFromCollection("products", pipeline);

    expect(ProductModel.aggregate).toHaveBeenCalledWith(pipeline);
    expect(OrderModel.aggregate).not.toHaveBeenCalled();
    expect(res).toEqual([{ productCount: 10 }]);
  });

  it("aggregateFromCollection(orders) should call OrderModel.aggregate", async () => {
    (OrderModel.aggregate as jest.Mock).mockResolvedValue([{ total: 99 }]);

    const pipeline: any[] = [{ $match: { paymentStatus: "paid" } }];

    const res = await repo.aggregateFromCollection("orders", pipeline);

    expect(OrderModel.aggregate).toHaveBeenCalledWith(pipeline);
    expect(ProductModel.aggregate).not.toHaveBeenCalled();
    expect(res).toEqual([{ total: 99 }]);
  });

  it("aggregateFromCollection(users) should throw Unsupported collection", async () => {
    const pipeline: any[] = [{ $match: {} }];

    await expect(
      repo.aggregateFromCollection("users", pipeline),
    ).rejects.toThrow("Unsupported collection");

    expect(ProductModel.aggregate).not.toHaveBeenCalled();
    expect(OrderModel.aggregate).not.toHaveBeenCalled();
  });
});
