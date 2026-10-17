import { Router } from "express";

import { validateCoupon, validateCouponBody } from "../controllers/couponController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import { couponValidationRateLimit } from "../middleware/rateLimit.js";
import { emptyBody } from "../controllers/wishlistController.js";

export const couponRouter = Router();
couponRouter.use(requireAuth);
couponRouter.post("/validate", couponValidationRateLimit, validateRequest({ body: validateCouponBody, query: emptyBody }), validateCoupon);
