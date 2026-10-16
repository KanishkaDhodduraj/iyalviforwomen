import { Router } from "express";

import { spinWheel, validateCoupon, validateCouponBody } from "../controllers/couponController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import { sensitiveRateLimit } from "../middleware/rateLimit.js";
import { emptyBody } from "../controllers/wishlistController.js";

export const couponRouter = Router();
couponRouter.use(requireAuth);
couponRouter.post("/validate", validateRequest({ body: validateCouponBody, query: emptyBody }), validateCoupon);

export const offerRouter = Router();
offerRouter.use(requireAuth, sensitiveRateLimit);
offerRouter.post("/spin", validateRequest({ body: emptyBody }), spinWheel);
