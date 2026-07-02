import { PipelineStage } from "mongoose";
import { AdminAnalyticsRepository } from "../../repositories/admin/analytics.repository";

export type DateRange = { from: Date; to: Date };
export type EarningsGroup = "daily" | "weekly" | "monthly";

export class AdminAnalyticsService {
  constructor(private repo = new AdminAnalyticsRepository()) {}

  private matchByRange(range: DateRange): PipelineStage.Match {
    return { $match: { createdAt: { $gte: range.from, $lte: range.to } } };
  }

  private addOrderRevenueFromItems(): PipelineStage.AddFields {
    return {
      $addFields: {
        orderRevenue: {
          $sum: {
            $map: {
              input: "$items",
              as: "it",
              in: {
                $multiply: [
                  { $ifNull: ["$$it.quantity", 0] },
                  { $ifNull: ["$$it.price", 0] },
                ],
              },
            },
          },
        },
      },
    };
  }

  async getKpis(range: DateRange) {
    const pipeline: PipelineStage[] = [
      this.matchByRange(range),
      this.addOrderRevenueFromItems(),
      {
        $group: {
          _id: null,
          revenue: { $sum: "$orderRevenue" },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: "$orderRevenue" },
          uniqueCustomers: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          _id: 0,
          revenue: { $ifNull: ["$revenue", 0] },
          orders: { $ifNull: ["$orders", 0] },
          avgOrderValue: { $ifNull: ["$avgOrderValue", 0] },
          customers: { $size: { $ifNull: ["$uniqueCustomers", []] } },
        },
      },
    ];

    const rows = await this.repo.aggregate<any>(pipeline);
    return (
      rows?.[0] ?? { revenue: 0, orders: 0, avgOrderValue: 0, customers: 0 }
    );
  }

  async getEarnings(range: DateRange, group: EarningsGroup) {
    const dateGroup =
      group === "monthly"
        ? { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }
        : group === "weekly"
          ? { year: { $year: "$createdAt" }, week: { $isoWeek: "$createdAt" } }
          : {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            };

    const pipeline: PipelineStage[] = [
      this.matchByRange(range),
      this.addOrderRevenueFromItems(),
      { $group: { _id: dateGroup, value: { $sum: "$orderRevenue" } } },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.week": 1, "_id.day": 1 } },
    ];

    return this.repo.aggregate<any>(pipeline);
  }

  async getCategoryShare(range: DateRange) {
    const pipeline: PipelineStage[] = [
      this.matchByRange(range),
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "p",
        },
      },
      { $unwind: "$p" },
      {
        $group: {
          _id: "$p.category",
          revenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
        },
      },
      { $sort: { revenue: -1 } },
    ];

    const rows = await this.repo.aggregate<any>(pipeline);
    const total =
      rows.reduce((s: number, r: any) => s + (r.revenue || 0), 0) || 1;

    return rows.map((r: any) => ({
      name: r._id ?? "Unknown",
      value: Number(((r.revenue / total) * 100).toFixed(2)),
    }));
  }

  async getTopProducts(range: DateRange, limit = 10) {
    const pipeline: PipelineStage[] = [
      this.matchByRange(range),
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          qty: { $sum: "$items.quantity" },
          revenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "p",
        },
      },
      { $unwind: "$p" },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: "$p.name",
          qty: 1,
          revenue: 1,
        },
      },
    ];

    return this.repo.aggregate<any>(pipeline);
  }

  async getDriversAnalytics(range: DateRange, limit = 10) {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          createdAt: { $gte: range.from, $lte: range.to },
          driverId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$driverId",
          assigned: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          shipped: {
            $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
      {
        $addFields: {
          pending: { $subtract: ["$assigned", "$delivered"] },
          deliveryRate: {
            $cond: [
              { $eq: ["$assigned", 0] },
              0,
              { $multiply: [{ $divide: ["$delivered", "$assigned"] }, 100] },
            ],
          },
        },
      },
      { $sort: { delivered: -1, deliveryRate: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "u",
        },
      },
      { $unwind: "$u" },
      {
        $project: {
          _id: 0,
          driverId: "$_id",
          name: "$u.username",
          email: "$u.email",
          assigned: 1,
          delivered: 1,
          shipped: 1,
          cancelled: 1,
          pending: 1,
          deliveryRate: { $round: ["$deliveryRate", 1] },
        },
      },
    ];

    return this.repo.aggregate<any>(pipeline);
  }

  async getTopViewedProducts(limit = 10) {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          viewCount: { $gt: 0 },
        },
      },
      { $sort: { viewCount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: "$name",
          viewCount: { $ifNull: ["$viewCount", 0] },
        },
      },
    ];

    const rows = await this.repo.aggregateFromCollection<any>(
      "products",
      pipeline,
    );

    const total =
      rows.reduce((s: number, r: any) => s + (r.viewCount || 0), 0) || 1;

    return rows.map((r: any) => ({
      name: r.name,
      viewCount: r.viewCount,
      share: Number(((r.viewCount / total) * 100).toFixed(1)),
    }));
  }
}
