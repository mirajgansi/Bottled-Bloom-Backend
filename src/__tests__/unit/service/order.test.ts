import mongoose, { Types } from "mongoose";

jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");

  const mockedMongoose = {
    ...actual,
    Types: actual.Types,
    startSession: jest.fn(), // <-- mocked here
  };

  return {
    __esModule: true,
    ...mockedMongoose, // named exports
    default: mockedMongoose, // default export
  };
});
jest.mock("../../../database/mongodb", () => ({
  connectDatabase: jest.fn(),
}));
jest.mock("../../../repositories/order.repository", () => ({
  OrderRepository: jest.fn(),
}));

jest.mock("../../../services/notification.service", () => ({
  NotificationService: jest.fn(),
}));

jest.mock("../../../models/order.model", () => ({
  OrderModel: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../../../models/cart.model", () => ({
  CartModel: {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock("../../../models/product.model", () => ({
  ProductModel: {
    updateOne: jest.fn(),
  },
}));

jest.mock("../../../models/user.model", () => ({
  UserModel: {
    findById: jest.fn(),
  },
}));

jest.mock("../../../dtos/order.dto", () => ({
  CreateOrderDto: {
    safeParse: jest.fn(),
  },
}));

describe("OrderService", () => {
  let service: any;

  let orderRepo: any;
  let notify: any;

  let mongoose: any;
  let OrderModel: any;
  let CartModel: any;
  let ProductModel: any;
  let UserModel: any;
  let CreateOrderDto: any;

  let session: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mongoose = jest.requireMock("mongoose");
    ({ OrderModel } = jest.requireMock("../../../models/order.model"));
    ({ CartModel } = jest.requireMock("../../../models/cart.model"));
    ({ ProductModel } = jest.requireMock("../../../models/product.model"));
    ({ UserModel } = jest.requireMock("../../../models/user.model"));
    ({ CreateOrderDto } = jest.requireMock("../../../dtos/order.dto"));

    orderRepo = {
      findAll: jest.fn(),
      findAssignedToDriver: jest.fn(),
    };

    notify = {
      notify: jest.fn(),
    };

    const orderRepoModule = jest.requireMock(
      "../../../repositories/order.repository",
    );
    orderRepoModule.OrderRepository.mockImplementation(() => orderRepo);

    const notifModule = jest.requireMock(
      "../../../services/notification.service",
    );
    notifModule.NotificationService.mockImplementation(() => notify);

    session = {
      withTransaction: jest.fn(async (fn: any) => fn()),
      endSession: jest.fn(),
    };

    mongoose.startSession.mockResolvedValue(session);

    const { OrderService } = require("../../../services/order.service");
    service = new OrderService();
  });

  // ---------------- createFromCart ----------------
  describe("createFromCart", () => {
    it("throws 401 if userId missing", async () => {
      await expect(service.createFromCart("", {})).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throws 400 if CreateOrderDto invalid", async () => {
      CreateOrderDto.safeParse.mockReturnValue({ success: false });

      await expect(service.createFromCart("u1", {})).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(mongoose.startSession).not.toHaveBeenCalled();
    });

    it("throws 400 if cart is empty", async () => {
      CreateOrderDto.safeParse.mockReturnValue({ success: true, data: {} });

      const chain = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockResolvedValue(null),
      };
      CartModel.findOne.mockReturnValue(chain);

      await expect(service.createFromCart("u1", {})).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(session.endSession).toHaveBeenCalled();
    });

    it("creates order, decrements stock, clears cart", async () => {
      CreateOrderDto.safeParse.mockReturnValue({
        success: true,
        data: {
          shippingFee: 50,
          shippingAddress: { city: "Ktm" },
          notes: "hi",
        },
      });

      const userId = "507f1f77bcf86cd799439011"; // ✅ valid ObjectId

      const prod1 = {
        _id: "p1",
        name: "Milk",
        price: 100,
        image: "a.jpg",
        inStock: 10,
      };
      const prod2 = {
        _id: "p2",
        name: "Bread",
        price: 40,
        image: "b.jpg",
        inStock: 5,
      };

      const cartDoc = {
        items: [
          { productId: prod1, quantity: 2 },
          { productId: prod2, quantity: 1 },
        ],
      };

      const chain = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockResolvedValue(cartDoc),
      };
      CartModel.findOne.mockReturnValue(chain);

      ProductModel.updateOne
        .mockResolvedValueOnce({ modifiedCount: 1 })
        .mockResolvedValueOnce({ modifiedCount: 1 });

      const createdOrder = { _id: "o1", userId, total: 290 };
      OrderModel.create.mockResolvedValue([createdOrder]);

      CartModel.updateOne.mockResolvedValue({ acknowledged: true });

      const res = await service.createFromCart(userId, {
        shippingFee: 50,
        shippingAddress: { city: "Ktm" },
        notes: "hi",
      });

      expect(res).toEqual(createdOrder);

      expect(ProductModel.updateOne).toHaveBeenCalledTimes(2);
      expect(ProductModel.updateOne).toHaveBeenCalledWith(
        { _id: "p1", inStock: { $gte: 2 } },
        { $inc: { inStock: -2 } },
        { session },
      );

      expect(OrderModel.create).toHaveBeenCalled();

      expect(CartModel.updateOne).toHaveBeenCalledWith(
        { userId },
        { $set: { items: [] } },
        { session },
      );

      expect(session.endSession).toHaveBeenCalled();
    });

    it("throws 400 if not enough stock", async () => {
      CreateOrderDto.safeParse.mockReturnValue({ success: true, data: {} });

      const prod = {
        _id: "p1",
        name: "Milk",
        price: 100,
        image: "a.jpg",
        inStock: 1,
      };
      const cartDoc = { items: [{ productId: prod, quantity: 3 }] };

      const chain = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockResolvedValue(cartDoc),
      };
      CartModel.findOne.mockReturnValue(chain);

      await expect(service.createFromCart("u1", {})).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(ProductModel.updateOne).not.toHaveBeenCalled();
      expect(OrderModel.create).not.toHaveBeenCalled();
    });

    it("throws 400 if stock update modifiedCount != 1", async () => {
      CreateOrderDto.safeParse.mockReturnValue({ success: true, data: {} });

      const prod = {
        _id: "p1",
        name: "Milk",
        price: 100,
        image: "a.jpg",
        inStock: 10,
      };
      const cartDoc = { items: [{ productId: prod, quantity: 2 }] };

      const chain = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockResolvedValue(cartDoc),
      };
      CartModel.findOne.mockReturnValue(chain);

      ProductModel.updateOne.mockResolvedValue({ modifiedCount: 0 });

      await expect(service.createFromCart("u1", {})).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(OrderModel.create).not.toHaveBeenCalled();
    });
  });

  // ---------------- getMyOrders ----------------
  describe("getMyOrders", () => {
    it("throws 401 if userId missing", async () => {
      await expect(service.getMyOrders("")).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("returns query sorted", async () => {
      const sortMock = jest.fn().mockResolvedValue([{ _id: "o1" }]);
      OrderModel.find.mockReturnValue({ sort: sortMock });

      const res = await service.getMyOrders("u1");

      expect(OrderModel.find).toHaveBeenCalledWith({ userId: "u1" });
      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res).toEqual([{ _id: "o1" }]);
    });
  });

  // ---------------- getOrderById ----------------
  describe("getOrderById", () => {
    it("throws 400 if orderId missing", async () => {
      await expect(service.getOrderById("")).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 404 if not found", async () => {
      OrderModel.findById.mockResolvedValue(null);

      await expect(service.getOrderById("o404")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("returns order when found", async () => {
      OrderModel.findById.mockResolvedValue({ _id: "o1" });

      await expect(service.getOrderById("o1")).resolves.toEqual({ _id: "o1" });
    });
  });

  // ---------------- getAllOrders ----------------
  describe("getAllOrders", () => {
    it("normalizes pagination + tab and returns pagination", async () => {
      orderRepo.findAll.mockResolvedValue({
        orders: [{ _id: "o1" }],
        total: 21,
      });

      const res = await service.getAllOrders({
        page: "2",
        size: "10",
        search: "milk",
        tab: "all",
      });

      expect(orderRepo.findAll).toHaveBeenCalledWith({
        page: 2,
        size: 10,
        search: "milk",
        tab: "all",
      });

      expect(res.pagination).toEqual({
        page: 2,
        size: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it("treats size='all' as 1000000", async () => {
      orderRepo.findAll.mockResolvedValue({ orders: [], total: 0 });

      const res = await service.getAllOrders({ size: "all" });

      expect(orderRepo.findAll).toHaveBeenCalledWith({
        page: 1,
        size: 1000000,
        search: "",
        tab: "all",
      });
      expect(res.pagination.size).toBe(1000000);
    });
  });

  // ---------------- getMyAssignedOrders ----------------
  describe("getMyAssignedOrders", () => {
    it("throws 401 if driverId missing", async () => {
      await expect(service.getMyAssignedOrders("")).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("returns orders + pagination", async () => {
      orderRepo.findAssignedToDriver.mockResolvedValue({
        orders: [{ _id: "o1" }],
        total: 21,
      });

      const res = await service.getMyAssignedOrders("d1", 2, 10);

      expect(orderRepo.findAssignedToDriver).toHaveBeenCalledWith("d1", 2, 10);
      expect(res.pagination.totalPages).toBe(3);
    });
  });

  // ---------------- driverUpdateStatus ----------------
  describe("driverUpdateStatus", () => {
    it("throws 401 if driverId missing", async () => {
      await expect(
        service.driverUpdateStatus("", "o1", "shipped"),
      ).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throws 400 if invalid order id", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(false);

      await expect(
        service.driverUpdateStatus("d1", "bad", "shipped"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 404 if order not found in transaction", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const findChain = { session: jest.fn().mockResolvedValue(null) };
      OrderModel.findById.mockReturnValue(findChain);

      await expect(
        service.driverUpdateStatus("d1", "o1", "shipped"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("delivered: sets paid, increments product totals, saves, notifies user", async () => {
      jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

      const order = {
        _id: { toString: () => "o1" },
        userId: { toString: () => "u1" },
        driverId: "d1",
        status: "shipped",
        paymentStatus: "unpaid",
        items: [{ productId: "p1", quantity: 2, lineTotal: 200 }],
        save: jest.fn().mockResolvedValue(true),
      };

      const findChain = { session: jest.fn().mockResolvedValue(order) };
      OrderModel.findById.mockReturnValue(findChain);

      ProductModel.updateOne.mockResolvedValue({ acknowledged: true });

      const res = await service.driverUpdateStatus("d1", "o1", "delivered");

      expect(order.paymentStatus).toBe("paid");
      expect(ProductModel.updateOne).toHaveBeenCalledWith(
        { _id: "p1" },
        { $inc: { totalSold: 2, totalRevenue: 200 } },
        { session },
      );
      expect(order.save).toHaveBeenCalledWith({ session });

      expect(notify.notify).toHaveBeenCalledWith(
        expect.objectContaining({ to: "u1", type: "order_delivered" }),
      );

      expect(res).toBe(order);
      expect(session.endSession).toHaveBeenCalled();
    });
  });
});
