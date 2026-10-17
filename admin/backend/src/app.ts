import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import "./config/db.js";
import { requireAdmin } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { mongoSanitizeExpress5 } from "./middleware/mongoSanitize.js";
import { emptyBody, emptyQuery } from "./middleware/validation.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { productImageRouter } from "./routes/productImageRoutes.js";
import { reportsRouter } from "./routes/reports.js";
import { sweepExpiredPromotions } from "./services/promotionExpiry.js";
import { hasValidCronAuthorization } from "./services/cronAuthorization.js";

export const app = express();
const uploadDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../uploads");
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY === "1" || env.TRUST_PROXY === "true");
app.use(helmet());
const allowedAdminOrigins = env.NODE_ENV === "development"
  ? ["http://localhost:8090", "http://127.0.0.1:8090"]
  : [env.ADMIN_CLIENT_URL];
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) {
      callback(null, false);
      return;
    }
    callback(null, allowedAdminOrigins.includes(origin) ? origin : false);
  },
}));
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(mongoSanitizeExpress5);
app.use(hpp());
app.use((request, response, next) => {
  if (!request.cookies?.admin_csrf) {
    response.cookie("admin_csrf", randomBytes(32).toString("hex"), {
      secure: env.NODE_ENV === "production",
      sameSite: env.COOKIE_SAME_SITE,
      httpOnly: false,
      path: "/",
    });
  }
  next();
});

app.use(
  "/uploads",
  express.static(uploadDirectory, {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    setHeaders(response) {
      response.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
app.get("/api/health", emptyQuery, emptyBody, (_request, response) => {
  response.json({ status: "ok" });
});
app.get("/api/cron/expire-promotions", emptyQuery, emptyBody, async (request, response) => {
  if (!hasValidCronAuthorization(request.get("authorization"), env.CRON_SECRET)) {
    response.status(env.CRON_SECRET ? 401 : 503).json({
      error: env.CRON_SECRET ? "Unauthorized" : "Cron is not configured",
    });
    return;
  }
  response.json(await sweepExpiredPromotions());
});
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", authRouter);
app.use("/api/products", requireAdmin, productImageRouter);
app.use("/api/reports", requireAdmin, reportsRouter);
app.use("/api", adminRouter);
app.use(notFound);
app.use(errorHandler);
