import { randomBytes, randomInt } from "node:crypto";

import type { RequestHandler } from "express";
import { z } from "zod";

import { HttpError } from "../middleware/errors.js";
import { Coupon } from "../models/Coupon.js";
import { User } from "../models/User.js";
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

export const spinWheel: RequestHandler = async (request, response) => {
  const userId = authUserId(request);
  const prizeIndex = randomPrize();
  const now = new Date();
  const user = await User.findOneAndUpdate(
    { _id: userId, $or: [{ lastSpinAt: { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }, { lastSpinAt: { $exists: false } }] },
    { $set: { lastSpinAt: now } },
    { new: true },
  ).exec();
  if (!user) throw new HttpError(429, "You can spin again after 24 hours");

  const code = `SPIN-${randomBytes(8).toString("hex").toUpperCase()}`;
  let coupon;
  try {
    coupon = await Coupon.create({
      code,
      type: prizeIndex === 2 ? "percent" : "flat",
      value: [100, 250, 10][prizeIndex]!,
      minOrder: 500,
      maxDiscount: prizeIndex === 2 ? 500 : undefined,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      usageLimit: 1,
      usedCount: 0,
      perUserLimit: 1,
      userRef: userId,
      isActive: true,
    });
  } catch (error) {
    await User.updateOne({ _id: userId, lastSpinAt: now }, { $unset: { lastSpinAt: 1 } }).exec();
    throw error;
  }
  response.status(201).json({
    coupon: { code: coupon.code, type: coupon.type, value: coupon.value, expiresAt: coupon.expiresAt },
  });
};

function randomPrize(): number {
  const choice = randomInt(0, 100);
  return choice < 50 ? 0 : choice < 85 ? 1 : 2;
}
