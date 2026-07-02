import { AdminAnalyticsController } from "../../../../controllers/admin/admin.analytics.controller";
import { AdminAnalyticsService } from "../../../../services/admin/analytics.service";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: any = {}) {
  return { query: {}, params: {}, body: {}, ...overrides } as any;
}

describe("AdminAnalyticsController", () => {
  let controller: AdminAnalyticsController;

  let getKpisSpy: jest.SpyInstance;
  let getEarningsSpy: jest.SpyInstance;
  let getCategoryShareSpy: jest.SpyInstance;
  let getTopProductsSpy: jest.SpyInstance;
  let getDriversAnalyticsSpy: jest.SpyInstance;
  let getTopViewedProductsSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new AdminAnalyticsController();

    getKpisSpy = jest.spyOn(AdminAnalyticsService.prototype as any, "getKpis");
    getEarningsSpy = jest.spyOn(
      AdminAnalyticsService.prototype as any,
      "getEarnings",
    );
    getCategoryShareSpy = jest.spyOn(
      AdminAnalyticsService.prototype as any,
      "getCategoryShare",
    );
    getTopProductsSpy = jest.spyOn(
      AdminAnalyticsService.prototype as any,
      "getTopProducts",
    );
    getDriversAnalyticsSpy = jest.spyOn(
      AdminAnalyticsService.prototype as any,
      "getDriversAnalytics",
    );
    getTopViewedProductsSpy = jest.spyOn(
      AdminAnalyticsService.prototype as any,
      "getTopViewedProducts",
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("kpis", () => {
    it("returns success true and calls service with parsed range (defaults)", async () => {
      const req = mockReq({ query: {} });
      const res = mockRes();

      getKpisSpy.mockResolvedValue({ totalOrders: 10 });

      await controller.kpis(req as any, res as any);

      expect(getKpisSpy).toHaveBeenCalledTimes(1);

      // check the range object shape
      const rangeArg = getKpisSpy.mock.calls[0][0];
      expect(rangeArg).toHaveProperty("from");
      expect(rangeArg).toHaveProperty("to");
      expect(rangeArg.from).toBeInstanceOf(Date);
      expect(rangeArg.to).toBeInstanceOf(Date);

      // to is set to end-of-day
      expect(rangeArg.to.getHours()).toBe(23);
      expect(rangeArg.to.getMinutes()).toBe(59);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { totalOrders: 10 },
      });
    });

    it("uses from/to query when provided", async () => {
      const req = mockReq({
        query: { from: "2026-02-01", to: "2026-02-10" },
      });
      const res = mockRes();

      getKpisSpy.mockResolvedValue({ ok: true });

      await controller.kpis(req as any, res as any);

      const rangeArg = getKpisSpy.mock.calls[0][0];
      expect(rangeArg.from.toISOString().slice(0, 10)).toBe("2026-02-01");
      expect(rangeArg.to.toISOString().slice(0, 10)).toBe("2026-02-10");
      // to end-of-day
      expect(rangeArg.to.getHours()).toBe(23);
      expect(rangeArg.to.getMinutes()).toBe(59);
    });
  });

  describe("earnings", () => {
    it("defaults group to daily", async () => {
      const req = mockReq({ query: {} });
      const res = mockRes();

      getEarningsSpy.mockResolvedValue([{ date: "x", total: 100 }]);

      await controller.earnings(req as any, res as any);

      expect(getEarningsSpy).toHaveBeenCalledTimes(1);
      const [, groupArg] = getEarningsSpy.mock.calls[0];
      expect(groupArg).toBe("daily");

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it("passes group from query", async () => {
      const req = mockReq({ query: { group: "monthly" } });
      const res = mockRes();

      getEarningsSpy.mockResolvedValue([]);

      await controller.earnings(req as any, res as any);

      const [, groupArg] = getEarningsSpy.mock.calls[0];
      expect(groupArg).toBe("monthly");
    });
  });

  describe("categoryShare", () => {
    it("calls service and returns success", async () => {
      const req = mockReq({ query: {} });
      const res = mockRes();

      getCategoryShareSpy.mockResolvedValue([{ category: "Food", share: 0.5 }]);

      await controller.categoryShare(req as any, res as any);

      expect(getCategoryShareSpy).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ category: "Food", share: 0.5 }],
      });
    });
  });

  describe("topProducts", () => {
    it("defaults limit=10", async () => {
      const req = mockReq({ query: {} });
      const res = mockRes();

      getTopProductsSpy.mockResolvedValue([{ _id: "p1" }]);

      await controller.topProducts(req as any, res as any);

      expect(getTopProductsSpy).toHaveBeenCalledTimes(1);
      const [, limitArg] = getTopProductsSpy.mock.calls[0];
      expect(limitArg).toBe(10);
    });

    it("uses limit from query", async () => {
      const req = mockReq({ query: { limit: "5" } });
      const res = mockRes();

      getTopProductsSpy.mockResolvedValue([]);

      await controller.topProducts(req as any, res as any);

      const [, limitArg] = getTopProductsSpy.mock.calls[0];
      expect(limitArg).toBe(5);
    });
  });

  describe("driversAnalytics", () => {
    it("defaults limit=10", async () => {
      const req = mockReq({ query: {} });
      const res = mockRes();

      getDriversAnalyticsSpy.mockResolvedValue([{ _id: "d1" }]);

      await controller.driversAnalytics(req as any, res as any);

      const [, limitArg] = getDriversAnalyticsSpy.mock.calls[0];
      expect(limitArg).toBe(10);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe("topViewedProducts", () => {
    it("returns success true (happy path)", async () => {
      const req = mockReq({ query: { limit: "3" } });
      const res = mockRes();

      getTopViewedProductsSpy.mockResolvedValue([{ _id: "p1" }]);

      await controller.topViewedProducts(req as any, res as any);

      expect(getTopViewedProductsSpy).toHaveBeenCalledWith(3);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ _id: "p1" }],
      });
    });

    it("500 when service throws", async () => {
      const req = mockReq({ query: {} });
      const res = mockRes();

      getTopViewedProductsSpy.mockRejectedValue(new Error("Boom"));

      await controller.topViewedProducts(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });
  });
});
