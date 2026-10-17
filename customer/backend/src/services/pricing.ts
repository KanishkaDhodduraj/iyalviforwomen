import mongoose, { type ClientSession } from "mongoose";
import { z } from "zod";

import { Coupon } from "../models/Coupon.js";
import { CouponRedemption } from "../models/CouponRedemption.js";
import { Discount } from "../models/Discount.js";
import { Product } from "../models/Product.js";
import { Setting } from "../models/Setting.js";
import { HttpError } from "../middleware/errors.js";
import { priceWithDiscounts, selectApplicableDiscounts, type DiscountSnapshot } from "./discounts.js";

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
  originalUnitPrice: number;
  discountAmount: number;
  discounts: DiscountSnapshot[];
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
  const ids = [...new Set(items.map(({ productId }) => productId.toLowerCase()))];
  let productQuery = Product.find({ _id: { $in: ids }, isActive: true, archived: { $ne: true } });
  if (session) productQuery = productQuery.session(session);
  const products = await productQuery.exec();
  const byId = new Map(products.map((product) => [String(product._id).toLowerCase(), product]));
  for (const item of items) {
    const product = byId.get(item.productId.toLowerCase());
    if (!product || sizeStock(product, item.size) === undefined || !(product.colors.length ? product.colors : ["Default"]).includes(item.color)) {
      throw new HttpError(400, "A cart item is unavailable");
    }
  }
  const now = new Date();
  let discountQuery = Discount.find({
    isActive: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  });
  if (session) discountQuery = discountQuery.session(session);
  const activeDiscounts = await discountQuery.sort({ priority: -1, _id: 1 }).lean().exec();
  const stockByProduct = new Map<string, number>();
  let productDiscountTotal = 0;

  const pricedItems = items.map((item) => {
    const product = byId.get(item.productId.toLowerCase());
    if (!product) throw new HttpError(400, "A cart item is unavailable");
    const stockKey = `${item.productId.toLowerCase()}\u0000${item.size}`;
    stockByProduct.set(stockKey, (stockByProduct.get(stockKey) ?? 0) + item.qty);
    const applicable = selectApplicableDiscounts(
      activeDiscounts,
      {
        id: item.productId.toLowerCase(),
        slug: product.slug,
        category: product.category ?? "",
        collection: product.subCategory,
      },
      now,
    );
    const basePrice = typeof product.mrp === "number" ? product.mrp : product.price;
    const price = priceWithDiscounts(basePrice, applicable);
    productDiscountTotal += price.discountAmount * item.qty;
    return {
      product: product._id,
      name: product.name,
      size: item.size,
      color: item.color,
      qty: item.qty,
      unitPrice: price.price,
      originalUnitPrice: basePrice,
      discountAmount: price.discountAmount * item.qty,
      discounts: price.discounts,
    };
  });

  for (const [stockKey, quantity] of stockByProduct) {
    const [productId, size] = stockKey.split("\u0000");
    const product = byId.get(productId!);
    if (!product || (sizeStock(product, size!) ?? 0) < quantity) {
      throw new HttpError(409, "Insufficient stock");
    }
  }

  const originalSubtotal = pricedItems.reduce((sum, item) => sum + item.originalUnitPrice * item.qty, 0);
  const discountedSubtotal = originalSubtotal - productDiscountTotal;
  let couponDiscount = 0;
  let normalizedCoupon: string | undefined;
  if (couponCode) {
    if (!userId) throw new HttpError(401, "Authentication required to use a coupon");
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      expiresAt: { $gt: now },
      $and: [
        { $or: [{ startsAt: { $lte: now } }, { startsAt: { $exists: false } }] },
        { $or: [{ userRef: null }, { userRef: { $exists: false } }, { userRef: userId }] },
      ],
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
    })
      .session(session ?? null)
      .exec();
    if (!coupon || discountedSubtotal < coupon.minOrder) throw new HttpError(400, "Coupon is invalid or unavailable");

    if (checkPerUserUsage) {
      const redemptionQuery = CouponRedemption.findOne({ coupon: coupon._id, user: userId });
      if (session) redemptionQuery.session(session);
      const redemption = await redemptionQuery.exec();
      if ((redemption?.usedCount ?? 0) >= coupon.perUserLimit) {
        throw new HttpError(400, "Coupon is invalid or unavailable");
      }
    }
    const amount = coupon.type === "percent" ? (discountedSubtotal * coupon.value) / 100 : coupon.value;
    couponDiscount = Math.min(
      Math.round(amount),
      coupon.maxDiscount ?? Number.MAX_SAFE_INTEGER,
      discountedSubtotal,
    );
    normalizedCoupon = coupon.code;
  }

  const discount = productDiscountTotal + couponDiscount;
  const setting = await Setting.findById("store-settings").select("freeShippingThreshold").lean().exec();
  const freeShippingThreshold = setting?.freeShippingThreshold ?? 999;
  const shipping = discountedSubtotal - couponDiscount > freeShippingThreshold ? 0 : 99;
  return {
    items: pricedItems,
    subtotal: originalSubtotal,
    discount,
    shipping,
    total: originalSubtotal - discount + shipping,
    ...(normalizedCoupon && { couponCode: normalizedCoupon }),
  };
}

function sizeStock(product: { sizes: unknown[]; stock: number }, size: string): number | undefined {
  if (product.sizes.length === 0 && size === "One Size") return product.stock;
  const match = product.sizes.find((entry) =>
    typeof entry === "string" ? entry === size : isSizeStock(entry) && entry.size === size,
  );
  if (typeof match === "string") return product.stock;
  return isSizeStock(match) ? match.stock : undefined;
}

function isSizeStock(value: unknown): value is { size: string; stock: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "size" in value &&
    "stock" in value &&
    typeof value.size === "string" &&
    typeof value.stock === "number"
  );
}

export async function consumeCoupon(
  couponCode: string,
  userId: string,
  session?: ClientSession,
): Promise<void> {
  const now = new Date();
  const coupon = await Coupon.findOneAndUpdate(
    {
      code: couponCode,
      isActive: true,
      expiresAt: { $gt: now },
      $and: [
        { $or: [{ startsAt: { $lte: now } }, { startsAt: { $exists: false } }] },
        { $or: [{ userRef: null }, { userRef: { $exists: false } }, { userRef: userId }] },
      ],
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
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
