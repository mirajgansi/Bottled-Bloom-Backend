jest.mock("../../../repositories/admin/analytics.repository", () => ({
  AdminAnalyticsRepository: jest.fn(),
}));
describe("AdminAnalyticsService", () => {
  let service: any;
  let repo: any;
  const range = {
    from: new Date("2026-01-01T00:00:00.000Z"),
    to: new Date("2026-01-31T23:59:59.999Z"),
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    repo = {
      aggregate: jest.fn(),
      aggregateFromCollection: jest.fn(),
    };

    const repoModule = jest.requireMock(
      "../../../repositories/admin/analytics.repository",
    );
    repoModule.AdminAnalyticsRepository.mockImplementation(() => repo);

    const {
      AdminAnalyticsService,
    } = require("../../../services/admin/analytics.service");

    service = new AdminAnalyticsService();
  });
  describe("getKpis", () => {
    it("returns first row", async () => {
      repo.aggregate.mockResolvedValue([
        { revenue: 100, orders: 2, avgOrderValue: 50, customers: 2 },
      ]);

      const res = await service.getKpis(range);

      expect(repo.aggregate).toHaveBeenCalledTimes(1);

      // pipeline sanity check
      const pipeline = repo.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({
        $match: { createdAt: { $gte: range.from, $lte: range.to } },
      });

      expect(res).toEqual({
        revenue: 100,
        orders: 2,
        avgOrderValue: 50,
        customers: 2,
      });
    });

    it("returns zeros if empty", async () => {
      repo.aggregate.mockResolvedValue([]);
      await expect(service.getKpis(range)).resolves.toEqual({
        revenue: 0,
        orders: 0,
        avgOrderValue: 0,
        customers: 0,
      });
    });

    it("returns zeros if undefined", async () => {
      repo.aggregate.mockResolvedValue(undefined);
      await expect(service.getKpis(range)).resolves.toEqual({
        revenue: 0,
        orders: 0,
        avgOrderValue: 0,
        customers: 0,
      });
    });
  });

  describe("getEarnings", () => {
    it("daily groups by year/month/day", async () => {
      repo.aggregate.mockResolvedValue([{ _id: {}, value: 10 }]);

      await service.getEarnings(range, "daily");

      const pipeline = repo.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({
        $match: { createdAt: { $gte: range.from, $lte: range.to } },
      });
      expect(pipeline[3]).toEqual({
        $sort: { "_id.year": 1, "_id.month": 1, "_id.week": 1, "_id.day": 1 },
      });
    });

    it("weekly uses isoWeek", async () => {
      repo.aggregate.mockResolvedValue([]);
      await service.getEarnings(range, "weekly");

      const pipeline = repo.aggregate.mock.calls[0][0];
      expect(pipeline[2].$group._id).toEqual({
        year: { $year: "$createdAt" },
        week: { $isoWeek: "$createdAt" },
      });
    });

    it("monthly uses year/month", async () => {
      repo.aggregate.mockResolvedValue([]);
      await service.getEarnings(range, "monthly");

      const pipeline = repo.aggregate.mock.calls[0][0];
      expect(pipeline[2].$group._id).toEqual({
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      });
    });
  });

  describe("getCategoryShare", () => {
    it("returns percentages with Unknown fallback", async () => {
      repo.aggregate.mockResolvedValue([
        { _id: "Shoes", revenue: 30 },
        { _id: null, revenue: 10 },
      ]); // total 40

      const res = await service.getCategoryShare(range);
      expect(res).toEqual([
        { name: "Shoes", value: 75.0 },
        { name: "Unknown", value: 25.0 },
      ]);
    });

    it("empty rows => []", async () => {
      repo.aggregate.mockResolvedValue([]);
      await expect(service.getCategoryShare(range)).resolves.toEqual([]);
    });
  });

  describe("getTopProducts", () => {
    it("uses limit", async () => {
      repo.aggregate.mockResolvedValue([{ productId: "p1" }]);
      await service.getTopProducts(range, 5);

      const pipeline = repo.aggregate.mock.calls[0][0];
      expect(pipeline).toEqual(expect.arrayContaining([{ $limit: 5 }]));
    });
  });

  describe("getDriversAnalytics", () => {
    it("has driverId exists match + limit", async () => {
      repo.aggregate.mockResolvedValue([{ driverId: "d1" }]);
      await service.getDriversAnalytics(range, 7);

      const pipeline = repo.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({
        $match: {
          createdAt: { $gte: range.from, $lte: range.to },
          driverId: { $exists: true, $ne: null },
        },
      });
      expect(pipeline).toEqual(expect.arrayContaining([{ $limit: 7 }]));
    });
  });

  describe("getTopViewedProducts", () => {
    it("uses aggregateFromCollection('products') and returns share", async () => {
      repo.aggregateFromCollection.mockResolvedValue([
        { name: "A", viewCount: 3 },
        { name: "B", viewCount: 1 },
      ]); // total 4

      const res = await service.getTopViewedProducts(10);

      expect(repo.aggregateFromCollection).toHaveBeenCalledWith(
        "products",
        expect.any(Array),
      );

      expect(res).toEqual([
        { name: "A", viewCount: 3, share: 75.0 },
        { name: "B", viewCount: 1, share: 25.0 },
      ]);
    });

    it("empty rows => []", async () => {
      repo.aggregateFromCollection.mockResolvedValue([]);
      await expect(service.getTopViewedProducts()).resolves.toEqual([]);
    });
  });
});
