/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- mongoose mock (default export must be mocked) ----
jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");

  const mockedMongoose = {
    ...actual,
    Types: actual.Types,
    startSession: jest.fn(),
  };

  return {
    __esModule: true,
    ...mockedMongoose,
    default: mockedMongoose,
  };
});

// ---- module mocks ----
jest.mock("../../../repositories/driver.repository", () => ({
  DriverRepository: jest.fn(),
}));

jest.mock("../../../models/order.model", () => ({
  OrderModel: {
    findById: jest.fn(),
  },
}));

jest.mock("../../../models/product.model", () => ({
  ProductModel: {
    updateOne: jest.fn(),
  },
}));

jest.mock("../../../services/notification.service", () => ({
  NotificationService: jest.fn(),
}));

describe("DriverService", () => {
  let service: any;
  let repo: any;
  let notify: any;
  let session: any;

  let mongoose: any;
  let OrderModel: any;
  let ProductModel: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mongoose = jest.requireMock("mongoose");
    ({ OrderModel } = jest.requireMock("../../../models/order.model"));
    ({ ProductModel } = jest.requireMock("../../../models/product.model"));

    repo = {
      findOrderById: jest.fn(),
      updateOrderStatus: jest.fn(),
      getDrivers: jest.fn(),
      getDriversStats: jest.fn(),
      getDriverStatsById: jest.fn(),
      findDriverById: jest.fn(),
      findOrdersByDriverIdPaginated: jest.fn(),
    };

    notify = {
      notify: jest.fn(),
    };

    // repo constructor injection (default param) needs mock implementation
    const repoModule = jest.requireMock(
      "../../../repositories/driver.repository",
    );
    repoModule.DriverRepository.mockImplementation(() => repo);

    const notifModule = jest.requireMock(
      "../../../services/notification.service",
    );
    notifModule.NotificationService.mockImplementation(() => notify);

    session = {
      withTransaction: jest.fn(async (fn: any) => fn()),
      endSession: jest.fn(),
    };

    mongoose.startSession.mockResolvedValue(session);

    const { DriverService } = require("../../../services/driver.service");
    service = new DriverService(); // uses mocked DriverRepository
  });

  // ---------------- driverUpdateStatus (transactional) ----------------
  describe("driverUpdateStatus", () => {
    it("throws 401 if driverId missing", async () => {
      await expect(
        service.driverUpdateStatus("", "o1", "shipped"),
      ).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throws 400 if invalid orderId", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(false);

      await expect(
        service.driverUpdateStatus("d1", "bad", "shipped"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(mongoose.startSession).not.toHaveBeenCalled();
    });

    it("throws 404 if order not found", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const chain = { session: jest.fn().mockResolvedValue(null) };
      OrderModel.findById.mockReturnValue(chain);

      await expect(
        service.driverUpdateStatus("d1", "o1", "shipped"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(session.endSession).toHaveBeenCalled();
    });

    it("throws 403 if order not assigned to driver", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const order = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: "otherDriver",
        status: "pending",
        items: [],
        save: jest.fn(),
      };

      const chain = { session: jest.fn().mockResolvedValue(order) };
      OrderModel.findById.mockReturnValue(chain);

      await expect(
        service.driverUpdateStatus("d1", "o1", "shipped"),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("throws 400 if status not allowed", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const order = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: "d1",
        status: "pending",
        items: [],
        save: jest.fn(),
      };

      const chain = { session: jest.fn().mockResolvedValue(order) };
      OrderModel.findById.mockReturnValue(chain);

      await expect(
        service.driverUpdateStatus("d1", "o1", "cancelled"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 400 if order already cancelled/delivered", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const order = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: "d1",
        status: "delivered",
        items: [],
        save: jest.fn(),
      };

      const chain = { session: jest.fn().mockResolvedValue(order) };
      OrderModel.findById.mockReturnValue(chain);

      await expect(
        service.driverUpdateStatus("d1", "o1", "shipped"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 400 if trying to deliver before shipped", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const order = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: "d1",
        status: "pending",
        paymentStatus: "unpaid",
        items: [],
        save: jest.fn(),
      };

      const chain = { session: jest.fn().mockResolvedValue(order) };
      OrderModel.findById.mockReturnValue(chain);

      await expect(
        service.driverUpdateStatus("d1", "o1", "delivered"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("shipped: sets status, saves, notifies user", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const order = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: "d1",
        status: "pending",
        paymentStatus: "unpaid",
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      const chain = { session: jest.fn().mockResolvedValue(order) };
      OrderModel.findById.mockReturnValue(chain);

      const res = await service.driverUpdateStatus("d1", "o1", "shipped");

      expect(order.status).toBe("shipped");
      expect(order.save).toHaveBeenCalledWith({ session });

      expect(notify.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "u1",
          type: "order_shipped",
          title: "Order Shipped",
        }),
      );

      expect(res).toBe(order);
      expect(session.endSession).toHaveBeenCalled();
    });

    it("delivered: sets paid, updates products totals, saves, notifies user", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const order = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: "d1",
        status: "shipped",
        paymentStatus: "unpaid",
        items: [
          { productId: "p1", quantity: 2, lineTotal: 200 },
          { productId: "p2", quantity: 1, lineTotal: 50 },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      const chain = { session: jest.fn().mockResolvedValue(order) };
      OrderModel.findById.mockReturnValue(chain);

      ProductModel.updateOne.mockResolvedValue({ acknowledged: true });

      const res = await service.driverUpdateStatus("d1", "o1", "delivered");

      expect(order.status).toBe("delivered");
      expect(order.paymentStatus).toBe("paid");

      expect(ProductModel.updateOne).toHaveBeenCalledWith(
        { _id: "p1" },
        { $inc: { totalSold: 2, totalRevenue: 200 } },
        { session },
      );
      expect(ProductModel.updateOne).toHaveBeenCalledWith(
        { _id: "p2" },
        { $inc: { totalSold: 1, totalRevenue: 50 } },
        { session },
      );

      expect(order.save).toHaveBeenCalledWith({ session });

      expect(notify.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "u1",
          type: "order_delivered",
          title: "Order Delivered",
        }),
      );

      expect(res).toBe(order);
      expect(session.endSession).toHaveBeenCalled();
    });
  });

  // ---------------- driverUpdateOrderStatus (repo-based) ----------------
  describe("driverUpdateOrderStatus", () => {
    it("returns invalid order id message if id invalid", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(false);

      const res = await service.driverUpdateOrderStatus("bad", "shipped");
      expect(res).toEqual({ success: false, message: "Invalid order id" });
    });

    it("returns order not found if repo returns null", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);
      repo.findOrderById.mockResolvedValue(null);

      const res = await service.driverUpdateOrderStatus("o1", "shipped");
      expect(res).toEqual({ success: false, message: "Order not found" });
    });

    it("returns cannot update cancelled order", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);
      repo.findOrderById.mockResolvedValue({ status: "cancelled" });

      const res = await service.driverUpdateOrderStatus("o1", "shipped");
      expect(res).toEqual({
        success: false,
        message: "Cannot update a cancelled order",
      });
    });

    it("returns order already delivered", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);
      repo.findOrderById.mockResolvedValue({ status: "delivered" });

      const res = await service.driverUpdateOrderStatus("o1", "shipped");
      expect(res).toEqual({
        success: false,
        message: "Order already delivered",
      });
    });

    it("returns order not found if update returns null", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);
      repo.findOrderById.mockResolvedValue({ status: "pending" });
      repo.updateOrderStatus.mockResolvedValue(null);

      const res = await service.driverUpdateOrderStatus("o1", "shipped");
      expect(res).toEqual({ success: false, message: "Order not found" });
    });

    it("shipped: notifies user + driver if driverId exists", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      repo.findOrderById.mockResolvedValue({ status: "pending" });

      const updated = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: { toString: () => "d1" },
        status: "shipped",
      };
      repo.updateOrderStatus.mockResolvedValue(updated);

      const res = await service.driverUpdateOrderStatus("o1", "shipped");

      expect(notify.notify).toHaveBeenCalledWith(
        expect.objectContaining({ to: "u1", type: "order_shipped" }),
      );
      expect(notify.notify).toHaveBeenCalledWith(
        expect.objectContaining({ to: "d1", type: "order_shipped" }),
      );

      expect(res).toEqual({
        success: true,
        message: "Order updated",
        data: updated,
      });
    });

    it("delivered: notifies user; driver notify only if driverId exists", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      repo.findOrderById.mockResolvedValue({ status: "shipped" });

      const updated = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: undefined, // optional
        status: "delivered",
      };
      repo.updateOrderStatus.mockResolvedValue(updated);

      const res = await service.driverUpdateOrderStatus("o1", "delivered");

      expect(notify.notify).toHaveBeenCalledWith(
        expect.objectContaining({ to: "u1", type: "order_delivered" }),
      );

      // only 1 notify call because driverId undefined
      expect(notify.notify).toHaveBeenCalledTimes(1);

      expect(res).toEqual({
        success: true,
        message: "Order updated",
        data: updated,
      });
    });
  });

  // ---------------- getDriversWithStats ----------------
  describe("getDriversWithStats", () => {
    it("returns enriched drivers with stats map defaults", async () => {
      repo.getDrivers.mockResolvedValue([
        { _id: "d1", name: "A" },
        { _id: "d2", name: "B" },
      ]);
      repo.getDriversStats.mockResolvedValue({
        d1: { totalAssigned: 5, deliveredCount: 2 },
        // d2 missing => should default to 0
      });

      const res = await service.getDriversWithStats({ search: "a" });

      expect(repo.getDrivers).toHaveBeenCalledWith({ search: "a" });
      expect(repo.getDriversStats).toHaveBeenCalled();

      expect(res).toEqual({
        success: true,
        data: [
          expect.objectContaining({
            _id: "d1",
            totalAssigned: 5,
            deliveredCount: 2,
          }),
          expect.objectContaining({
            _id: "d2",
            totalAssigned: 0,
            deliveredCount: 0,
          }),
        ],
      });
    });
  });

  // ---------------- getDriverStatsById ----------------
  describe("getDriverStatsById", () => {
    it("returns invalid driver id if not valid ObjectId", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(false);

      const res = await service.getDriverStatsById("bad");
      expect(res).toEqual({ success: false, message: "Invalid driver id" });
    });

    it("returns stats when valid", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);
      repo.getDriverStatsById.mockResolvedValue({ deliveredCount: 10 });

      const res = await service.getDriverStatsById("507f1f77bcf86cd799439011");

      expect(repo.getDriverStatsById).toHaveBeenCalled();
      expect(res).toEqual({ success: true, data: { deliveredCount: 10 } });
    });
  });

  // ---------------- getDriverDetailById ----------------
  describe("getDriverDetailById", () => {
    it("returns invalid driver id if not valid ObjectId", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(false);

      const res = await service.getDriverDetailById("bad", 1, 10);
      expect(res).toEqual({ success: false, message: "Invalid driver id" });
    });

    it("returns driver not found if repo returns null", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);
      repo.findDriverById.mockResolvedValue(null);

      const res = await service.getDriverDetailById(
        "507f1f77bcf86cd799439011",
        1,
        10,
      );
      expect(res).toEqual({ success: false, message: "Driver not found" });
    });

    it("returns driver detail with stats and orders pagination", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const driverId = "507f1f77bcf86cd799439011";
      const driver = { _id: driverId, name: "Driver" };

      repo.findDriverById.mockResolvedValue(driver);
      repo.getDriverStatsById.mockResolvedValue({ deliveredCount: 3 });

      repo.findOrdersByDriverIdPaginated.mockResolvedValue({
        orders: [{ _id: "o1" }],
        pagination: { page: 1, size: 10, total: 1, totalPages: 1 },
      });

      const res = await service.getDriverDetailById(driverId, 1, 10);

      expect(repo.findDriverById).toHaveBeenCalledWith(driverId);
      expect(repo.getDriverStatsById).toHaveBeenCalledWith(driverId);
      expect(repo.findOrdersByDriverIdPaginated).toHaveBeenCalledWith(
        driverId,
        1,
        10,
      );

      expect(res).toEqual({
        success: true,
        data: {
          driver,
          stats: { deliveredCount: 3 },
          orders: [{ _id: "o1" }],
          pagination: { page: 1, size: 10, total: 1, totalPages: 1 },
        },
      });
    });
  });
});
