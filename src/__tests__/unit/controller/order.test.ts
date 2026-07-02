// ✅ mock OrderService BEFORE importing controller
const serviceMock = {
  createFromCart: jest.fn(),
  getMyOrders: jest.fn(),
  getOrderById: jest.fn(),
  getAllOrders: jest.fn(),
  updateStatus: jest.fn(),
  cancelMyOrder: jest.fn(),
  assignDriver: jest.fn(),
  getMyAssignedOrders: jest.fn(),
  driverUpdateStatus: jest.fn(),
};

jest.mock("../../../services/order.service", () => ({
  OrderService: jest.fn().mockImplementation(() => serviceMock),
}));

jest.mock("../../../dtos/order.dto", () => ({
  AssignDriverDto: { safeParse: jest.fn() },
  UpdateOrderStatusDto: { safeParse: jest.fn() },
}));

import { OrderController } from "../../../controllers/order.controller";
import { AssignDriverDto, UpdateOrderStatusDto } from "../../../dtos/order.dto";

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

describe("OrderController (unit)", () => {
  let controller: OrderController;

  beforeEach(() => {
    controller = new OrderController();
    jest.clearAllMocks();
  });

  // ---------------- createFromCart ----------------
  it("createFromCart -> 401 if no userId", async () => {
    const req: any = { user: undefined, body: {} };
    const res = makeRes();

    await controller.createFromCart(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized",
    });
  });

  it("createFromCart -> 201 on success", async () => {
    serviceMock.createFromCart.mockResolvedValue({ _id: "o1" });

    const req: any = { user: { id: "u1" }, body: { address: "x" } };
    const res = makeRes();

    await controller.createFromCart(req, res as any);

    expect(serviceMock.createFromCart).toHaveBeenCalledWith("u1", {
      address: "x",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Order created" }),
    );
  });

  // ---------------- getMyOrders ----------------
  it("getMyOrders -> 401 if no userId", async () => {
    const req: any = { user: undefined };
    const res = makeRes();

    await controller.getMyOrders(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("getMyOrders -> returns res.json (no status) on success", async () => {
    serviceMock.getMyOrders.mockResolvedValue([{ _id: "o1" }]);

    const req: any = { user: { id: "u1" } };
    const res = makeRes();

    await controller.getMyOrders(req, res as any);

    expect(serviceMock.getMyOrders).toHaveBeenCalledWith("u1");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ _id: "o1" }],
    });
  });

  // ---------------- getOrderById ----------------
  it("getOrderById -> 403 if non-admin/driver tries to access other user's order", async () => {
    serviceMock.getOrderById.mockResolvedValue({ _id: "o1", userId: "owner1" });

    const req: any = {
      user: { id: "otherUser", role: "user" },
      params: { id: "o1" },
    };
    const res = makeRes();

    await controller.getOrderById(req, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Forbidden",
    });
  });

  it("getOrderById -> allow admin", async () => {
    serviceMock.getOrderById.mockResolvedValue({ _id: "o1", userId: "owner1" });

    const req: any = { user: { id: "x", role: "admin" }, params: { id: "o1" } };
    const res = makeRes();

    await controller.getOrderById(req, res as any);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { _id: "o1", userId: "owner1" },
    });
  });

  it("getOrderById -> allow driver", async () => {
    serviceMock.getOrderById.mockResolvedValue({ _id: "o1", userId: "owner1" });

    const req: any = {
      user: { id: "x", role: "driver" },
      params: { id: "o1" },
    };
    const res = makeRes();

    await controller.getOrderById(req, res as any);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { _id: "o1", userId: "owner1" },
    });
  });

  it("getOrderById -> allow owner user", async () => {
    serviceMock.getOrderById.mockResolvedValue({ _id: "o1", userId: "u1" });

    const req: any = { user: { id: "u1", role: "user" }, params: { id: "o1" } };
    const res = makeRes();

    await controller.getOrderById(req, res as any);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { _id: "o1", userId: "u1" },
    });
  });

  // ---------------- getAllOrders ----------------
  it("getAllOrders -> 200 success", async () => {
    serviceMock.getAllOrders.mockResolvedValue({ orders: [], total: 0 });

    const req: any = { query: { page: "1", size: "10", search: "abc" } };
    const res = makeRes();

    await controller.getAllOrders(req, res as any);

    expect(serviceMock.getAllOrders).toHaveBeenCalledWith({
      page: "1",
      size: "10",
      search: "abc",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ---------------- updateStatus ----------------
  it("updateStatus -> 400 if UpdateOrderStatusDto invalid", async () => {
    (UpdateOrderStatusDto.safeParse as jest.Mock).mockReturnValue({
      success: false,
      error: { issues: [{ path: ["status"], message: "Required" }] },
    });

    const req: any = { params: { id: "o1" }, body: {} };
    const res = makeRes();

    await controller.updateStatus(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Invalid input" }),
    );
  });

  it("updateStatus -> success calls service.updateStatus", async () => {
    (UpdateOrderStatusDto.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { status: "shipped", paymentStatus: "paid" },
    });

    serviceMock.updateStatus.mockResolvedValue({
      _id: "o1",
      status: "shipped",
    });

    const req: any = { params: { id: "o1" }, body: { status: "shipped" } };
    const res = makeRes();

    await controller.updateStatus(req, res as any);

    expect(serviceMock.updateStatus).toHaveBeenCalledWith("o1", {
      status: "shipped",
      paymentStatus: "paid",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Order updated" }),
    );
  });

  // ---------------- cancelMyOrder ----------------
  it("cancelMyOrder -> calls service and returns json", async () => {
    serviceMock.cancelMyOrder.mockResolvedValue({
      _id: "o1",
      status: "cancelled",
    });

    const req: any = { user: { _id: "u1" }, params: { id: "o1" } };
    const res = makeRes();

    await controller.cancelMyOrder(req, res as any);

    expect(serviceMock.cancelMyOrder).toHaveBeenCalledWith("o1", "u1");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Order cancelled" }),
    );
  });

  // ---------------- assignDriver ----------------
  it("assignDriver -> 400 if AssignDriverDto invalid", async () => {
    (AssignDriverDto.safeParse as jest.Mock).mockReturnValue({
      success: false,
      error: { issues: [{ path: ["driverId"], message: "Required" }] },
    });

    const req: any = {
      body: {},
      params: { id: "o1" },
      user: { _id: "admin1" },
    };
    const res = makeRes();

    await controller.assignDriver(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("assignDriver -> 401 if no adminId", async () => {
    (AssignDriverDto.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { driverId: "d1" },
    });

    const req: any = {
      body: { driverId: "d1" },
      params: { id: "o1" },
      user: undefined,
    };
    const res = makeRes();

    await controller.assignDriver(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized",
    });
  });

  it("assignDriver -> success calls service.assignDriver", async () => {
    (AssignDriverDto.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { driverId: "d1" },
    });

    serviceMock.assignDriver.mockResolvedValue({ _id: "o1", driverId: "d1" });

    const req: any = {
      body: { driverId: "d1" },
      params: { id: "o1" },
      user: { _id: "admin1" },
    };
    const res = makeRes();

    await controller.assignDriver(req, res as any);

    expect(serviceMock.assignDriver).toHaveBeenCalledWith("o1", "d1", "admin1");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Driver assigned" }),
    );
  });

  // ---------------- getMyAssignedOrders ----------------
  it("getMyAssignedOrders -> 401 if no driverId", async () => {
    const req: any = { user: undefined, query: {} };
    const res = makeRes();

    await controller.getMyAssignedOrders(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("getMyAssignedOrders -> success with page/size", async () => {
    serviceMock.getMyAssignedOrders.mockResolvedValue({
      orders: [],
      pagination: { page: 1 },
    });

    const req: any = { user: { _id: "d1" }, query: { page: "2", size: "5" } };
    const res = makeRes();

    await controller.getMyAssignedOrders(req, res as any);

    expect(serviceMock.getMyAssignedOrders).toHaveBeenCalledWith("d1", 2, 5);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Assigned orders fetched",
      }),
    );
  });

  // ---------------- driverUpdateStatus ----------------
  it("driverUpdateStatus -> 200 success", async () => {
    serviceMock.driverUpdateStatus.mockResolvedValue({
      _id: "o1",
      status: "delivered",
    });

    const req: any = {
      user: { id: "d1" },
      params: { id: "o1" },
      body: { status: "delivered" },
    };
    const res = makeRes();

    await controller.driverUpdateStatus(req, res as any);

    expect(serviceMock.driverUpdateStatus).toHaveBeenCalledWith(
      "d1",
      "o1",
      "delivered",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ---------------- error status code path ----------------
  it("should return error.statusCode if service throws", async () => {
    serviceMock.getAllOrders.mockRejectedValue({
      statusCode: 503,
      message: "Service down",
    });

    const req: any = { query: {} };
    const res = makeRes();

    await controller.getAllOrders(req, res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Service down",
    });
  });
});
