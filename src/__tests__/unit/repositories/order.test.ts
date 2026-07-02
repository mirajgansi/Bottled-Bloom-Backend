import mongoose from "mongoose";
import { OrderRepository } from "../../../repositories/order.repository";
import { OrderModel } from "../../../models/order.model";

jest.mock("../../../models/order.model", () => ({
  OrderModel: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

describe("OrderRepository (unit)", () => {
  let repo: OrderRepository;

  beforeEach(() => {
    repo = new OrderRepository();
    jest.clearAllMocks();
  });

  it("create should call OrderModel.create with array payload and return first element", async () => {
    (OrderModel.create as jest.Mock).mockResolvedValue([{ _id: "o1" }]);

    const res = await repo.create({ userId: "u1", total: 100 });

    expect(OrderModel.create).toHaveBeenCalledWith(
      [{ userId: "u1", total: 100 }],
      undefined,
    );
    expect(res).toEqual({ _id: "o1" });
  });

  it("create should pass session when provided", async () => {
    (OrderModel.create as jest.Mock).mockResolvedValue([{ _id: "o1" }]);
    const session = { id: "session1" };

    await repo.create({ a: 1 }, session);

    expect(OrderModel.create).toHaveBeenCalledWith([{ a: 1 }], { session });
  });

  it("findById should call OrderModel.findById", async () => {
    (OrderModel.findById as jest.Mock).mockResolvedValue({ _id: "o1" });

    const res = await repo.findById("o1");

    expect(OrderModel.findById).toHaveBeenCalledWith("o1");
    expect(res).toEqual({ _id: "o1" });
  });

  it("findByUserIdPaginated should sanitize page/size and return meta", async () => {
    const limitMock = jest.fn().mockResolvedValue([{ _id: "o1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (OrderModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (OrderModel.countDocuments as jest.Mock).mockResolvedValue(25);

    const userId = "507f1f77bcf86cd799439011";
    const res = await repo.findByUserIdPaginated(userId, 0 as any, 999 as any);

    // page -> 1, size -> 100
    expect(OrderModel.find).toHaveBeenCalledWith({
      userId: new mongoose.Types.ObjectId(userId),
    });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skipMock).toHaveBeenCalledWith(0);
    expect(limitMock).toHaveBeenCalledWith(100);

    expect(res.meta).toEqual({
      page: 1,
      size: 100,
      total: 25,
      totalPages: Math.ceil(25 / 100),
    });
    expect(res.data).toEqual([{ _id: "o1" }]);
  });

  it("findAll should apply search filter ($or) when search provided", async () => {
    const limitMock = jest.fn().mockResolvedValue([{ _id: "o1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (OrderModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (OrderModel.countDocuments as jest.Mock).mockResolvedValue(1);

    await repo.findAll({ page: 2, size: 10, search: "kath", tab: "all" });

    expect(OrderModel.find).toHaveBeenCalledWith({
      $or: [
        { "shippingAddress.userName": { $regex: "kath", $options: "i" } },
        { "shippingAddress.phone": { $regex: "kath", $options: "i" } },
        { "shippingAddress.city": { $regex: "kath", $options: "i" } },
      ],
    });

    expect(skipMock).toHaveBeenCalledWith((2 - 1) * 10);
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it("findAll tab=unpaid should filter paymentStatus=unpaid", async () => {
    const limitMock = jest.fn().mockResolvedValue([]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (OrderModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (OrderModel.countDocuments as jest.Mock).mockResolvedValue(0);

    await repo.findAll({ page: 1, size: 10, tab: "unpaid" });

    expect(OrderModel.find).toHaveBeenCalledWith({ paymentStatus: "unpaid" });
  });

  it("findAll tab=pending should filter status='pending'", async () => {
    const limitMock = jest.fn().mockResolvedValue([]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (OrderModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (OrderModel.countDocuments as jest.Mock).mockResolvedValue(0);

    await repo.findAll({ page: 1, size: 10, tab: "pending" });

    expect(OrderModel.find).toHaveBeenCalledWith({ status: "pending" });
  });

  it("findAll tab=open should filter status not in delivered/cancelled", async () => {
    const limitMock = jest.fn().mockResolvedValue([]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (OrderModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (OrderModel.countDocuments as jest.Mock).mockResolvedValue(0);

    await repo.findAll({ page: 1, size: 10, tab: "open" });

    expect(OrderModel.find).toHaveBeenCalledWith({
      status: { $nin: ["delivered", "cancelled"] },
    });
  });

  it("findAll tab=closed should filter status in delivered/cancelled", async () => {
    const limitMock = jest.fn().mockResolvedValue([]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (OrderModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (OrderModel.countDocuments as jest.Mock).mockResolvedValue(0);

    await repo.findAll({ page: 1, size: 10, tab: "closed" });

    expect(OrderModel.find).toHaveBeenCalledWith({
      status: { $in: ["delivered", "cancelled"] },
    });
  });

  it("updateStatus should call findByIdAndUpdate with new:true", async () => {
    (OrderModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      _id: "o1",
      status: "shipped",
    });

    const res = await repo.updateStatus("o1", {
      status: "shipped",
      paymentStatus: "paid",
    });

    expect(OrderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "o1",
      { status: "shipped", paymentStatus: "paid" },
      { new: true },
    );
    expect(res).toEqual({ _id: "o1", status: "shipped" });
  });

  it("assignDriver should set driverId, assignedAt, status=shipped", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));

    (OrderModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      _id: "o1",
      driverId: "d1",
    });

    await repo.assignDriver("o1", "d1");

    expect(OrderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "o1",
      {
        driverId: "d1",
        assignedAt: new Date("2026-03-01T12:00:00.000Z"),
        status: "shipped",
      },
      { new: true },
    );

    jest.useRealTimers();
  });

  it("findAssignedToDriver should query by driverId ObjectId and paginate", async () => {
    const limitMock = jest.fn().mockResolvedValue([{ _id: "o1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (OrderModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (OrderModel.countDocuments as jest.Mock).mockResolvedValue(3);

    const driverId = "507f1f77bcf86cd799439012";
    const res = await repo.findAssignedToDriver(driverId, 2, 5);

    expect(OrderModel.find).toHaveBeenCalledWith({
      driverId: new mongoose.Types.ObjectId(driverId),
    });
    expect(skipMock).toHaveBeenCalledWith((2 - 1) * 5);
    expect(limitMock).toHaveBeenCalledWith(5);

    expect(OrderModel.countDocuments).toHaveBeenCalledWith({
      driverId: new mongoose.Types.ObjectId(driverId),
    });

    expect(res).toEqual({ orders: [{ _id: "o1" }], total: 3 });
  });

  it("driverUpdateStatus shipped should only set status", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));

    (OrderModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      _id: "o1",
      status: "shipped",
    });

    await repo.driverUpdateStatus("o1", "shipped");

    expect(OrderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "o1",
      { status: "shipped" },
      { new: true },
    );

    jest.useRealTimers();
  });

  it("driverUpdateStatus delivered should set paid + deliveredAt", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));

    (OrderModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      _id: "o1",
      status: "delivered",
      paymentStatus: "paid",
    });

    await repo.driverUpdateStatus("o1", "delivered");

    expect(OrderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "o1",
      {
        status: "delivered",
        paymentStatus: "paid",
        deliveredAt: new Date("2026-03-01T12:00:00.000Z"),
      },
      { new: true },
    );

    jest.useRealTimers();
  });
});
