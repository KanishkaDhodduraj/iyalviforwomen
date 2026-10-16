import { Router } from "express";

import { priceBody, priceCart } from "../controllers/cartController.js";
import { emptyBody } from "../controllers/wishlistController.js";
import { optionalAuth } from "../middleware/auth.js";
import { cartPricingRateLimit } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";

export const cartRouter = Router();
cartRouter.post(
  "/price",
  cartPricingRateLimit,
  optionalAuth,
  validateRequest({ body: priceBody, query: emptyBody }),
  priceCart,
);
