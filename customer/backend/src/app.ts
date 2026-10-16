import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import hpp from "hpp";
import mongoose from "mongoose";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./config/env.js";
import { authRouter } from "./routes/authRoutes.js";
import { addressRouter } from "./routes/addressRoutes.js";
import { adminOrderRouter, orderRouter } from "./routes/orderRoutes.js";
import { cartRouter } from "./routes/cartRoutes.js";
import { couponRouter, offerRouter } from "./routes/couponRoutes.js";
import { productRouter } from "./routes/productRoutes.js";
import { wishlistRouter } from "./routes/wishlistRoutes.js";
import { contactRouter } from "./routes/contactRoutes.js";
import { errorHandler, HttpError, notFoundHandler } from "./middleware/errors.js";
import { globalRateLimit, sensitiveRateLimit } from "./middleware/rateLimit.js";
import { csrfProtection } from "./middleware/auth.js";
import { validateRequest } from "./middleware/validate.js";
import { z } from "zod";

export const app = express();
const productUploadDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../uploads");

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (origin === env.CLIENT_URL) {
        callback(null, origin);
        return;
      }
      if (!origin) {
        callback(null, false);
        return;
      }
      callback(new HttpError(403, "Origin not allowed"));
    },
  }),
);
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use((request, _response, next) => {
  const inputs = [request.body, request.params, request.query, request.headers];
  for (const value of inputs) {
    if (value && typeof value === "object" && mongoSanitize.has(value as Record<string, unknown>)) {
      next(new HttpError(400, "Invalid request"));
      return;
    }
  }
  next();
});
app.use(hpp());
app.use(globalRateLimit);
app.use(csrfProtection);
app.use(
  "/uploads",
  express.static(productUploadDirectory, {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    setHeaders(response) {
      response.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

app.get("/api/health", validateRequest({ query: z.object({}).strict() }), (_request, response) => {
  response.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});
app.use("/api/auth", authRouter);
app.use("/api/products", productRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/addresses", addressRouter);
app.use("/api/cart", cartRouter);
app.use("/api/coupons", couponRouter);
app.use("/api/offers", offerRouter);
app.use("/api/orders", orderRouter);
app.use("/api/admin/orders", adminOrderRouter);
app.use("/api/payments", sensitiveRateLimit);
app.use("/api/contact", contactRouter);

app.use(notFoundHandler);
app.use(errorHandler);
