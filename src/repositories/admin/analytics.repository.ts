import { PipelineStage } from "mongoose";
import { OrderModel } from "../../models/order.model";
import { ProductModel } from "../../models/product.model";

export class AdminAnalyticsRepository {
  async aggregate<T = any>(pipeline: PipelineStage[]) {
    return OrderModel.aggregate<T>(pipeline);
  }

  async aggregateFromCollection<T>(
    collection: "products" | "orders" | "users",
    pipeline: PipelineStage[],
  ) {
    if (collection === "products") return ProductModel.aggregate<T>(pipeline);
    if (collection === "orders") return OrderModel.aggregate<T>(pipeline);
    throw new Error("Unsupported collection");
  }
}
