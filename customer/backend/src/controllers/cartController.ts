import type { RequestHandler } from "express";
import { z } from "zod";

import { calculateCartPrice, cartItemSchema } from "../services/pricing.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const priceBody = z
  .object({
    items: z.array(cartItemSchema).min(1).max(50),
    couponCode: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const priceCart: RequestHandler = async (request, response) => {
  const body = priceBody.parse(request.body);
  const userId = (request as AuthenticatedRequest).auth?.id;
  const price = await calculateCartPrice(userId, body.items, body.couponCode);
  response.json(price);
};
