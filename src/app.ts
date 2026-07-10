import express, { Application, Request, Response } from "express";
import bodyParser from "body-parser";
import { connectDatabase } from "./database/mongodb";
import { PORT } from "./config";
import authRoutes from "./routes/auth.route";
import productRoutes from "./routes/product.route";
import cartRoutes from "./routes/cart.route";
import adminUserRoutes from "./routes/admin/user.route";
import orderRoutes from "./routes/order.route";
import diverRoutes from "./routes/driver.route";
import adminAnalyticsRoute from "./routes/admin/admin.analytics.route";
import notificationRoutes from "./routes/notification.route";
import cors from "cors";
import path from "path";
import mongoSanitize from "express-mongo-sanitize";
import { globalLimiter } from "./middleware/ratelimit.middleware";
import helmet from "helmet";

const app: Application = express();

let corsOptions = {
  origin: ["http://localhost:3000", "http://localhost:3003"],
  //list of accepted domain
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});
// Custom sanitize middleware — Express 5 compatible
app.use((req, _res, next) => {
  if (req.body) {
    req.body = mongoSanitize.sanitize(req.body);
  }
  if (req.params) {
    req.params = mongoSanitize.sanitize(req.params);
  }
  if (req.query && Object.keys(req.query).length > 0) {
    const sanitizedQuery = mongoSanitize.sanitize({ ...req.query });
    Object.keys(req.query).forEach((key) => delete (req.query as any)[key]);
    Object.assign(req.query, sanitizedQuery);
  }
  next();
});

app.use(globalLimiter);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/notifications", notificationRoutes);

app.use("/api/admin/users", adminUserRoutes);
app.get("/", (req: Request, res: Response) => {
  return res
    .status(200)
    .json({ success: "true", message: "Welcome to the API" });
});
app.use("/api/driver", diverRoutes);

app.use("/api/orders", orderRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/admin/analytics", adminAnalyticsRoute);

app.use((err: any, req: Request, res: Response, _next: any) => {
  console.error("ERROR:", err);

  return res.status(err.statusCode ?? 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;
