import { Router } from "express";

import { submitContactMessage, contactBody } from "../controllers/contactController.js";
import { emptyBody } from "../controllers/wishlistController.js";
import { sensitiveRateLimit } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";

export const contactRouter = Router();
contactRouter.post(
  "/",
  sensitiveRateLimit,
  validateRequest({ body: contactBody, query: emptyBody }),
  submitContactMessage,
);
