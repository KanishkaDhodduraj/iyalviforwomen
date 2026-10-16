import { Router } from "express";

import { getProduct, listProducts, productListQuery, productSlugParams } from "../controllers/productController.js";
import { publicCatalogRateLimit } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";

export const productRouter = Router();
productRouter.use(publicCatalogRateLimit);
productRouter.get("/", validateRequest({ query: productListQuery }), listProducts);
productRouter.get(
  "/:slug",
  validateRequest({ params: productSlugParams, query: productListQuery.pick({}).strict() }),
  getProduct,
);
