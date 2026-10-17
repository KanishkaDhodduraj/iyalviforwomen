import rateLimit from "express-rate-limit";

const DEVELOPMENT_MULTIPLIER = 10;
const MESSAGE = "Too many requests, please wait a moment";

export function configuredLimit(
  limit: number,
  scaleInDevelopment = true,
  nodeEnv = process.env.NODE_ENV,
): number {
  return nodeEnv === "development" && scaleInDevelopment
    ? limit * DEVELOPMENT_MULTIPLIER
    : limit;
}

export function createLimiter(limit: number, windowMs: number, scaleInDevelopment = true) {
  return rateLimit({
    windowMs,
    limit: configuredLimit(limit, scaleInDevelopment),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response) => {
      response.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      response.status(429).json({ message: MESSAGE });
    },
  });
}

const minute = 60 * 1000;
const quarterHour = 15 * minute;

export const publicReadRateLimit = createLimiter(300, minute);
export const authMeRateLimit = createLimiter(120, minute);
export const cartPricingRateLimit = createLimiter(120, minute);
export const couponValidationRateLimit = createLimiter(120, minute);
export const authRateLimit = createLimiter(10, quarterHour);
export const registerRateLimit = createLimiter(10, quarterHour);
export const loginRateLimit = createLimiter(10, quarterHour, false);
export const sensitiveRateLimit = createLimiter(5, quarterHour);
export const orderRateLimit = createLimiter(20, quarterHour);
export const publicCatalogRateLimit = publicReadRateLimit;
export const reviewRateLimit = createLimiter(5, quarterHour);
