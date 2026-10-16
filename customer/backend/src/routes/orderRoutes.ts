import { Router } from "express";

import {
  cancelOrder,
  createOrder,
  getOrder,
  listAdminOrders,
  listOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { emptyBody } from "../controllers/wishlistController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  adminOrderQuery,
  orderCreateBody,
  orderIdParams,
  orderListQuery,
  orderStatusBody,
} from "../services/orders.js";
import { orderRateLimit } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";

export const orderRouter = Router();
orderRouter.use(requireAuth, orderRateLimit);
orderRouter.post("/", validateRequest({ body: orderCreateBody }), createOrder);
orderRouter.get("/", validateRequest({ query: orderListQuery }), listOrders);
orderRouter.get("/:id", validateRequest({ params: orderIdParams }), getOrder);
orderRouter.post("/:id/cancel", validateRequest({ params: orderIdParams, body: emptyBody }), cancelOrder);
orderRouter.patch(
  "/:id/status",
  requireRole("admin"),
  validateRequest({ params: orderIdParams, body: orderStatusBody }),
  updateOrderStatus,
);

export const adminOrderRouter = Router();
adminOrderRouter.use(requireAuth, requireRole("admin"), orderRateLimit);
adminOrderRouter.get("/", validateRequest({ query: adminOrderQuery }), listAdminOrders);
