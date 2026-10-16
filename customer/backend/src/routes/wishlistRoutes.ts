import { Router } from "express";

import {
  addWishlistProduct,
  emptyBody,
  getWishlist,
  productIdParams,
  removeWishlistProduct,
} from "../controllers/wishlistController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);
wishlistRouter.get("/", validateRequest({ query: emptyBody }), getWishlist);
wishlistRouter.post("/:productId", validateRequest({ params: productIdParams, body: emptyBody }), addWishlistProduct);
wishlistRouter.delete(
  "/:productId",
  validateRequest({ params: productIdParams, body: emptyBody }),
  removeWishlistProduct,
);
