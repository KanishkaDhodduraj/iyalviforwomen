import type { RequestHandler } from "express";
import { z } from "zod";

import { authUserId } from "../services/sessions.js";
import { calculateCartPrice, cartItemSchema } from "../services/pricing.js";

export const validateCouponBody = z
  .object({
    code: z.string().trim().min(1).max(40),
    items: z.array(cartItemSchema).min(1).max(50),
  })
  .strict();

export const validateCoupon: RequestHandler = async (request, response) => {
  const { code, items } = validateCouponBody.parse(request.body);
  const price = await calculateCartPrice(authUserId(request), items, code, undefined, false);
  response.json({ valid: true, code: price.couponCode, discount: price.discount, total: price.total });
};
