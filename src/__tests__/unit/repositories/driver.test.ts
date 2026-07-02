import mongoose from "mongoose";
import { DriverRepository } from "../../../repositories/driver.repository";
import { UserModel } from "../../../models/user.model";
import { OrderModel } from "../../../models/order.model";

jest.mock("../../../models/user.model", () => ({
  UserModel: {
    findByIdAndUpdate: jest.fn(),
    findById: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock("../../../models/order.model", () => ({
  OrderModel: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
}));

describe("DriverRepository (unit)", () => {
  let repo: DriverRepository;

  beforeEach(() => {
    repo = new DriverRepository();
    jest.clearAllMocks();
  });

  it("updateDriverStatus should call UserModel.findByIdAndUpdate with new:true", async () => {
    (UserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      _id: "d1",
      status: "active",
    });

    const res = await repo.updateDriverStatus("d1", "active");

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "d1",
      { status: "active" },
      { new: true },
    );
    expect(res).toEqual({ _id: "d1", status: "active" });
  });

  it("findDriverById should call UserModel.findById", async () => {
    (UserModel.findById as jest.Mock).mockResolvedValue({ _id: "d1" });

    const res = await repo.findDriverById("d1");

    expect(UserModel.findById).toHaveBeenCalledWith("d1");
    expect(res).toEqual({ _id: "d1" });
  });

  it("findOrderById should call OrderModel.findById", async () => {
    (OrderModel.findById as jest.Mock).mockResolvedValue({ _id: "o1" });

    const res = await repo.findOrderById("o1");

    expect(OrderModel.findById).toHaveBeenCalledWith("o1");
    expect(res).toEqual({ _id: "o1" });
  });

  it("assignDriverToOrder should set driverId ObjectId and status shipped", async () => {
    (OrderModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      _id: "o1",
      status: "shipped",
    });

    const driverId = "507f1f77bcf86cd799439011";
    await repo.assignDriverToOrder("o1", driverId);

    const [orderIdArg, updateArg, optsArg] = (
      OrderModel.findByIdAndUpdate as jest.Mock
    ).mock.calls[0];

    expect(orderIdArg).toBe("o1");
    expect(updateArg.status).toBe("shipped");
    expect(updateArg.driverId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(updateArg.driverId)).toBe(driverId);
    expect(optsArg).toEqual({ new: true });
  });

  it("updateOrderStatus should call OrderModel.findByIdAndUpdate with new:true", async () => {
    (OrderModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      _id: "o1",
      status: "delivered",
    });

    const res = await repo.updateOrderStatus("o1", "delivered");

    expect(OrderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "o1",
      { status: "delivered" },
      { new: true },
    );
    expect(res).toEqual({ _id: "o1", status: "delivered" });
  });

  it("getDrivers should build aggregate pipeline without search", async () => {
    (UserModel.aggregate as jest.Mock).mockResolvedValue([{ _id: "d1" }]);

    const res = await repo.getDrivers();

    expect(UserModel.aggregate).toHaveBeenCalledTimes(1);
    const pipeline = (UserModel.aggregate as jest.Mock).mock.calls[0][0];

    // first stage match role=driver only
    expect(pipeline[0]).toEqual({ $match: { role: "driver" } });

    // ensure lookup + unwind + project exist
    expect(pipeline.some((s: any) => s.$lookup)).toBe(true);
    expect(pipeline.some((s: any) => s.$unwind)).toBe(true);
    expect(pipeline.some((s: any) => s.$project)).toBe(true);

    expect(res).toEqual([{ _id: "d1" }]);
  });

  it("getDrivers should include $or search when search provided", async () => {
    (UserModel.aggregate as jest.Mock).mockResolvedValue([]);

    await repo.getDrivers({ search: " mi  " });

    const pipeline = (UserModel.aggregate as jest.Mock).mock.calls[0][0];
    const matchStage = pipeline[0].$match;

    expect(matchStage.role).toBe("driver");
    expect(matchStage.$or).toEqual([
      { username: { $regex: "mi", $options: "i" } },
      { email: { $regex: "mi", $options: "i" } },
      { phoneNumber: { $regex: "mi", $options: "i" } },
    ]);
  });

  it("getDriversStats should return map keyed by driverId string", async () => {
    (OrderModel.aggregate as jest.Mock).mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
        totalAssigned: 5,
        deliveredCount: 3,
      },
      {
        _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439013"),
        totalAssigned: 2,
        deliveredCount: 2,
      },
    ]);

    const res = await repo.getDriversStats();

    expect(OrderModel.aggregate).toHaveBeenCalledWith([
      { $match: { driverId: { $ne: null } } },
      {
        $group: {
          _id: "$driverId",
          totalAssigned: { $sum: 1 },
          deliveredCount: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
        },
      },
    ]);

    expect(res).toEqual({
      "507f1f77bcf86cd799439012": { totalAssigned: 5, deliveredCount: 3 },
      "507f1f77bcf86cd799439013": { totalAssigned: 2, deliveredCount: 2 },
    });
  });

  it("getDriverStatsById should return zeros if no row returned", async () => {
    (OrderModel.aggregate as jest.Mock).mockResolvedValue([]);

    const driverId = "507f1f77bcf86cd799439011";
    const res = await repo.getDriverStatsById(driverId);

    const pipeline = (OrderModel.aggregate as jest.Mock).mock.calls[0][0];
    expect(pipeline[0].$match.driverId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(pipeline[0].$match.driverId)).toBe(driverId);

    expect(res).toEqual({ totalAssigned: 0, deliveredCount: 0 });
  });

  it("getDriverStatsById should return totals from aggregate row", async () => {
    (OrderModel.aggregate as jest.Mock).mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
        totalAssigned: 9,
        deliveredCount: 7,
      },
    ]);

    const res = await repo.getDriverStatsById("507f1f77bcf86cd799439011");
    expect(res).toEqual({ totalAssigned: 9, deliveredCount: 7 });
  });

  it("findOrdersByDriverIdPaginated should sanitize page/size and return pagination", async () => {
    // chain: find().sort().skip().limit()
    const limitMock = jest.fn().mockResolvedValue([{ _id: "o1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (OrderModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (OrderModel.countDocuments as jest.Mock).mockResolvedValue(25);

    const driverId = "507f1f77bcf86cd799439011";
    const res = await repo.findOrdersByDriverIdPaginated(
      driverId,
      0 as any,
      999 as any,
    );

    // page -> 1, size -> 100
    const filterArg = (OrderModel.find as jest.Mock).mock.calls[0][0];
    expect(filterArg.driverId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(filterArg.driverId)).toBe(driverId);

    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skipMock).toHaveBeenCalledWith(0);
    expect(limitMock).toHaveBeenCalledWith(100);

    expect(res.orders).toEqual([{ _id: "o1" }]);
    expect(res.pagination).toEqual({
      page: 1,
      size: 100,
      total: 25,
      totalPages: Math.max(1, Math.ceil(25 / 100)),
    });
  });
});
