import rateLimit from "express-rate-limit";

const commonOptions = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  handler: (_request: unknown, response: import("express").Response) => {
    response.status(429).json({ error: "Too many requests" });
  },
};

export const globalRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 100,
});

export const authRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

export const sensitiveRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
});

export const orderRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

export const publicCatalogRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 60,
});

export const cartPricingRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 30,
});
