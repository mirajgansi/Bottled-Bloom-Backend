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

// 🟡 FIX (Gap #10): trust proxy was never set. Without it, req.ip resolves
// to the reverse proxy's IP for every request once this is deployed behind
// any load balancer/PaaS, so all rate limiters (globalLimiter, authLimiter,
// etc.) collapse onto a single shared bucket — or, on newer
// express-rate-limit versions, requests start throwing
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR outright.
//
// This is env-driven since you haven't picked a host yet:
//   TRUST_PROXY unset/"0"  -> false  (no proxy — safe default for local dev)
//   TRUST_PROXY="1"        -> 1      (exactly one hop — most single-LB PaaS:
//                                      Render, Railway, Heroku, Fly.io)
//   TRUST_PROXY="2"        -> 2      (two hops — e.g. CDN + platform LB)
//
// Deliberately NOT supporting a bare `true` here: that trusts the entire
// X-Forwarded-For chain, letting a client spoof its own IP by just sending
// that header, which defeats IP-based rate limiting entirely. Once you
// deploy, set TRUST_PROXY to the exact number of hops in front of Node —
// not more, not fewer — and verify by logging req.ip against the platform's
// dashboard IP for a real request before relying on it.
const trustProxyHops = parseInt(process.env.TRUST_PROXY ?? "0", 10);
app.set("trust proxy", trustProxyHops > 0 ? trustProxyHops : false);

// 1. Security headers — first, so every response gets them
app.use(
  helmet({
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);

// 2. CORS
const corsOptions = {
  origin: ["http://localhost:3000", "http://localhost:3003"],
};
app.use(cors(corsOptions));

// 3. Body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 4. Request logger — single instance, log-injection safe
app.use((req, _res, next) => {
  const safeUrl = req.url.replace(/[\r\n]/g, "");
  console.log("➡️", req.method, safeUrl);
  next();
});

// 5. NoSQL injection sanitization — Express 5 compatible custom wrapper
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

// 6. Rate limiting
app.use(globalLimiter);

// Routes
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
