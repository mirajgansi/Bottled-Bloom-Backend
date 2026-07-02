import { DriverController } from "../../../controllers/driver.controller";
import { DriverService } from "../../../services/driver.service";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function mockReq(overrides: any = {}) {
  return { body: {}, params: {}, query: {}, user: {}, ...overrides } as any;
}

describe("DriverController", () => {
  let controller: DriverController;

  let driverUpdateStatusSpy: jest.SpyInstance;
  let driverUpdateOrderStatusSpy: jest.SpyInstance;
  let getDriversWithStatsSpy: jest.SpyInstance;
  let getDriverStatsByIdSpy: jest.SpyInstance;
  let getDriverDetailByIdSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new DriverController();

    driverUpdateStatusSpy = jest.spyOn(
      DriverService.prototype as any,
      "driverUpdateStatus",
    );
    driverUpdateOrderStatusSpy = jest.spyOn(
      DriverService.prototype as any,
      "driverUpdateOrderStatus",
    );
    getDriversWithStatsSpy = jest.spyOn(
      DriverService.prototype as any,
      "getDriversWithStats",
    );
    getDriverStatsByIdSpy = jest.spyOn(
      DriverService.prototype as any,
      "getDriverStatsById",
    );
    getDriverDetailByIdSpy = jest.spyOn(
      DriverService.prototype as any,
      "getDriverDetailById",
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("driverUpdateStatus", () => {
    it("200 updates status (happy path)", async () => {
      const req = mockReq({
        user: { id: "driver1" },
        params: { id: "order1" },
        body: { status: "shipped" },
      });
      const res = mockRes();

      driverUpdateStatusSpy.mockResolvedValue({
        _id: "order1",
        status: "shipped",
      });

      await controller.driverUpdateStatus(req, res);

      expect(driverUpdateStatusSpy).toHaveBeenCalledWith(
        "driver1",
        "order1",
        "shipped",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Order status updated",
        }),
      );
    });

    it("returns error.statusCode on throw", async () => {
      const req = mockReq({
        user: { id: "driver1" },
        params: { id: "order1" },
        body: { status: "delivered" },
      });
      const res = mockRes();

      const err: any = new Error("Not allowed");
      err.statusCode = 403;
      driverUpdateStatusSpy.mockRejectedValue(err);

      await controller.driverUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: "Not allowed" }),
      );
    });
  });

  describe("driverUpdateOrderStatus", () => {
    it("400 when service returns success:false", async () => {
      const req = mockReq({
        params: { id: "order1" },
        body: { status: "shipped" },
      });
      const res = mockRes();

      driverUpdateOrderStatusSpy.mockResolvedValue({
        success: false,
        message: "Bad status",
      });

      await controller.driverUpdateOrderStatus(req, res);

      expect(driverUpdateOrderStatusSpy).toHaveBeenCalledWith(
        "order1",
        "shipped",
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it("200 when success:true (returns res.json)", async () => {
      const req = mockReq({
        params: { id: "order1" },
        body: { status: "delivered" },
      });
      const res = mockRes();

      driverUpdateOrderStatusSpy.mockResolvedValue({
        success: true,
        message: "Updated",
        data: { _id: "order1", status: "delivered" },
      });

      await controller.driverUpdateOrderStatus(req, res);

      // This endpoint uses res.json(result) (no explicit status)
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: "Updated" }),
      );
    });
  });

  describe("getDriversByStats", () => {
    it("returns res.json(result) and passes search", async () => {
      const req = mockReq({ query: { search: "mi" } });
      const res = mockRes();

      getDriversWithStatsSpy.mockResolvedValue({
        success: true,
        data: [{ _id: "d1" }],
      });

      await controller.getDriversByStats(req, res);

      expect(getDriversWithStatsSpy).toHaveBeenCalledWith({ search: "mi" });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe("getDriverStatsById", () => {
    it("returns success true with data", async () => {
      const req = mockReq({ params: { id: "driver1" } });
      const res = mockRes();

      getDriverStatsByIdSpy.mockResolvedValue({ totalOrders: 10 });

      await controller.getDriverStatsById(req, res);

      expect(getDriverStatsByIdSpy).toHaveBeenCalledWith("driver1");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { totalOrders: 10 },
      });
    });
  });

  describe("getDriverDetailById", () => {
    it("uses default page=1 size=10 when not provided", async () => {
      const req = mockReq({ params: { id: "driver1" }, query: {} });
      const res = mockRes();

      getDriverDetailByIdSpy.mockResolvedValue({
        success: true,
        data: { items: [] },
      });

      await controller.getDriverDetailById(req, res);

      expect(getDriverDetailByIdSpy).toHaveBeenCalledWith("driver1", 1, 10);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it("casts page/size to numbers", async () => {
      const req = mockReq({
        params: { id: "driver1" },
        query: { page: "2", size: "5" },
      });
      const res = mockRes();

      getDriverDetailByIdSpy.mockResolvedValue({
        success: true,
        data: { items: [] },
      });

      await controller.getDriverDetailById(req, res);

      expect(getDriverDetailByIdSpy).toHaveBeenCalledWith("driver1", 2, 5);
    });

    it("400 when service returns success:false", async () => {
      const req = mockReq({
        params: { id: "driver1" },
        query: { page: "1", size: "10" },
      });
      const res = mockRes();

      getDriverDetailByIdSpy.mockResolvedValue({
        success: false,
        message: "Driver not found",
      });

      await controller.getDriverDetailById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Driver not found",
        }),
      );
    });
  });
});
