import mongoose, { type ClientSession } from "mongoose";
import { z } from "zod";

import { Coupon } from "../models/Coupon.js";
import { CouponRedemption } from "../models/CouponRedemption.js";
import { Product } from "../models/Product.js";
import { HttpError } from "../middleware/errors.js";

export const cartItemSchema = z
  .object({
    productId: z.string().regex(/^[a-f\d]{24}$/i),
    size: z.string().trim().min(1).max(40),
    color: z.string().trim().min(1).max(60),
    qty: z.number().int().min(1).max(10),
  })
  .strict();

export const couponUseSchema = z.object({ couponCode: z.string().trim().min(1).max(40).optional() }).strict();

export type CartItemInput = (typeof cartItemSchema)["_output"];

export interface PricedItem {
  product: mongoose.Types.ObjectId;
  name: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
}

export interface CartPrice {
  items: PricedItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode?: string;
}

export async function calculateCartPrice(
  userId: string | undefined,
  items: CartItemInput[],
  couponCode?: string,
  session?: ClientSession,
  checkPerUserUsage = true,
): Promise<CartPrice> {
  if (items.length === 0 || items.length > 50) throw new HttpError(400, "Cart must contain 1 to 50 items");
  const ids = [...new Set(items.map(({ productId }) => productId))];
  let productQuery = Product.find({ _id: { $in: ids }, isActive: true });
  if (session) productQuery = productQuery.session(session);
  const products = await productQuery.exec();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const stockByProduct = new Map<string, number>();

  const pricedItems = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.sizes.includes(item.size) || !product.colors.includes(item.color)) {
      throw new HttpError(400, "A cart item is unavailable");
    }
    stockByProduct.set(item.productId, (stockByProduct.get(item.productId) ?? 0) + item.qty);
    return {
      product: product._id,
      name: product.name,
      size: item.size,
      color: item.color,
      qty: item.qty,
      unitPrice: product.price,
    };
  });

  for (const [productId, quantity] of stockByProduct) {
    if ((byId.get(productId)?.stock ?? 0) < quantity) {
      throw new HttpError(409, "Insufficient stock");
    }
  }

  const subtotal = pricedItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  let discount = 0;
  let normalizedCoupon: string | undefined;
  if (couponCode) {
    if (!userId) throw new HttpError(401, "Authentication required to use a coupon");
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
      $or: [{ userRef: null }, { userRef: { $exists: false } }, { userRef: userId }],
    })
      .session(session ?? null)
      .exec();
    if (!coupon || subtotal < coupon.minOrder) throw new HttpError(400, "Coupon is invalid or unavailable");

    if (checkPerUserUsage) {
      const redemptionQuery = CouponRedemption.findOne({ coupon: coupon._id, user: userId });
      if (session) redemptionQuery.session(session);
      const redemption = await redemptionQuery.exec();
      if ((redemption?.usedCount ?? 0) >= coupon.perUserLimit) {
        throw new HttpError(400, "Coupon is invalid or unavailable");
      }
    }
    const amount = coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
    discount = Math.min(Math.round(amount), coupon.maxDiscount ?? Number.MAX_SAFE_INTEGER, subtotal);
    normalizedCoupon = coupon.code;
  }

  const shipping = subtotal > 999 ? 0 : 99;
  return {
    items: pricedItems,
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    ...(normalizedCoupon && { couponCode: normalizedCoupon }),
  };
}

export async function consumeCoupon(
  couponCode: string,
  userId: string,
  session?: ClientSession,
): Promise<void> {
  const coupon = await Coupon.findOneAndUpdate(
    {
      code: couponCode,
      isActive: true,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
      $or: [{ userRef: null }, { userRef: { $exists: false } }, { userRef: userId }],
    },
    { $inc: { usedCount: 1 } },
    { new: true, ...(session && { session }) },
  ).exec();
  if (!coupon) throw new HttpError(409, "Coupon is no longer available");

  try {
    const redemptionQuery = CouponRedemption.findOneAndUpdate(
      {
        coupon: coupon._id,
        user: userId,
        $or: [{ usedCount: { $lt: coupon.perUserLimit } }, { usedCount: { $exists: false } }],
      },
      { $inc: { usedCount: 1 } },
      { new: true, upsert: true, ...(session && { session }) },
    );
    const redemption = await redemptionQuery.exec();
    if (!redemption || redemption.usedCount > coupon.perUserLimit) {
      throw new HttpError(409, "Coupon usage limit reached");
    }
  } catch (error) {
    await Coupon.updateOne(
      { _id: coupon._id, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
      session ? { session } : undefined,
    ).exec();
    if (error instanceof HttpError) throw error;
    if (isDuplicateKey(error)) throw new HttpError(409, "Coupon usage limit reached");
    throw error;
  }
}

export async function releaseCoupon(
  couponCode: string,
  userId: string,
  session?: ClientSession,
): Promise<void> {
  const couponLookup = Coupon.findOne({ code: couponCode }).select("_id");
  if (session) couponLookup.session(session);
  const coupon = await couponLookup.exec();
  if (!coupon) return;
  const couponQuery = Coupon.findOneAndUpdate({ _id: coupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  const redemptionQuery = CouponRedemption.findOneAndUpdate(
    { coupon: coupon._id, user: userId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );
  if (session) {
    couponQuery.session(session);
    redemptionQuery.session(session);
  }
  await couponQuery.exec();
  await redemptionQuery.exec();
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
