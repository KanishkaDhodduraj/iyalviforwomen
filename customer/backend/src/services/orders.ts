import mongoose, { type ClientSession } from "mongoose";
import { z } from "zod";

import { HttpError } from "../middleware/errors.js";
import { env } from "../config/env.js";
import { Address } from "../models/Address.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { consumeCoupon, calculateCartPrice, releaseCoupon, type CartItemInput, type CartPrice } from "./pricing.js";

export function createOrderCreateBody(demoPayments = env.DEMO_PAYMENTS) {
  return z
    .object({
    items: z.array(
      z
        .object({
          productId: z.string().regex(/^[a-f\d]{24}$/i),
          size: z.string().trim().min(1).max(40),
          color: z.string().trim().min(1).max(60),
          qty: z.number().int().min(1).max(10),
        })
        .strict(),
    ).min(1).max(50),
    addressId: z.string().regex(/^[a-f\d]{24}$/i),
    couponCode: z.string().trim().min(1).max(40).optional(),
      paymentMethod: z.enum(["COD", "UPI", "CARD", "NETBANKING"]).default("COD"),
    })
    .strict()
    .superRefine((body, context) => {
      if (!demoPayments && body.paymentMethod !== "COD") {
        context.addIssue({
          code: "custom",
          path: ["paymentMethod"],
          message: "Only COD payments are available",
        });
      }
    });
}

export function allowedPaymentMethods(demoPayments = env.DEMO_PAYMENTS): readonly string[] {
  return demoPayments ? ["COD", "UPI", "CARD", "NETBANKING"] : ["COD"];
}

export const orderCreateBody = createOrderCreateBody();

export const orderIdParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
export const orderListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export const adminOrderQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"]).optional(),
  })
  .strict();
export const orderStatusBody = z
  .object({ status: z.enum(["packed", "shipped", "out_for_delivery", "delivered"]) })
  .strict();

export async function decrementStock(items: CartItemInput[], session?: ClientSession): Promise<void> {
  const quantities = aggregateQuantities(items);
  const decremented: Array<[string, string, number, boolean]> = [];
  try {
    for (const { productId, size, qty } of quantities.values()) {
      const variantResult = await Product.updateOne(
        { _id: productId, isActive: true, archived: { $ne: true }, stock: { $gte: qty }, sizes: { $elemMatch: { size, stock: { $gte: qty } } } },
        { $inc: { stock: -qty, "sizes.$.stock": -qty } },
        session ? { session } : undefined,
      ).exec();
      if (variantResult.modifiedCount === 1) {
        decremented.push([productId, size, qty, true]);
        continue;
      }
      if (size !== "One Size") throw new HttpError(409, "Insufficient stock");
      const totalStockResult = await Product.updateOne(
        { _id: productId, isActive: true, archived: { $ne: true }, stock: { $gte: qty }, sizes: { $size: 0 } },
        { $inc: { stock: -qty } },
        session ? { session } : undefined,
      ).exec();
      if (totalStockResult.modifiedCount !== 1) throw new HttpError(409, "Insufficient stock");
      decremented.push([productId, size, qty, false]);
    }
  } catch (error) {
    if (!session) {
      for (const [productId, size, qty, hasSizeVariants] of decremented) {
        if (hasSizeVariants) {
          await Product.updateOne({ _id: productId, sizes: { $elemMatch: { size } } }, { $inc: { stock: qty, "sizes.$.stock": qty } }).exec();
        } else {
          await Product.updateOne({ _id: productId, sizes: { $size: 0 } }, { $inc: { stock: qty } }).exec();
        }
      }
    }
    throw error;
  }
}

export async function restoreStock(
  items: Array<{ product: unknown; size: string; qty: number }>,
  session?: ClientSession,
): Promise<void> {
  for (const { productId, size, qty } of aggregateOrderQuantities(items).values()) {
    const variantResult = await Product.updateOne(
      { _id: productId, sizes: { $elemMatch: { size } } },
      { $inc: { stock: qty, "sizes.$.stock": qty } },
      session ? { session } : undefined,
    ).exec();
    if (variantResult.modifiedCount === 0 && size === "One Size") {
      await Product.updateOne({ _id: productId, sizes: { $size: 0 } }, { $inc: { stock: qty } }, session ? { session } : undefined).exec();
    }
  }
}

export function isAllowedStatusTransition(current: string, next: string): boolean {
  return (
    (current === "placed" && next === "packed") ||
    (current === "packed" && next === "shipped") ||
    (current === "shipped" && next === "out_for_delivery") ||
    (current === "out_for_delivery" && next === "delivered")
  );
}

export async function findOwnedOrder(orderId: string, userId: string) {
  const order = await Order.findOne({ _id: orderId, user: userId }).exec();
  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

export async function reserveAndCreateOrder(
  input: {
    userId: string;
    items: CartItemInput[];
    addressId: string;
    paymentMethod: "COD" | "UPI" | "CARD" | "NETBANKING";
    demo?: boolean;
    couponCode?: string;
    idempotencyKey?: string;
  },
): Promise<InstanceType<typeof Order>> {
  if (input.idempotencyKey) {
    const existing = await Order.findOne({ user: input.userId, idempotencyKey: input.idempotencyKey }).exec();
    if (existing) return existing;
  }

  const address = await Address.findOne({ _id: input.addressId, user: input.userId }).lean().exec();
  if (!address) throw new HttpError(404, "Address not found");

  const makeOrder = async (session?: ClientSession) => {
    const price: CartPrice = await calculateCartPrice(input.userId, input.items, input.couponCode, session);
    await decrementStock(input.items, session);
    if (price.couponCode) await consumeCoupon(price.couponCode, input.userId, session);
    const [order] = await Order.create(
      [
        {
          user: input.userId,
          items: price.items,
          address: {
            name: address.name,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
          },
          subtotal: price.subtotal,
          discount: price.discount,
          shipping: price.shipping,
          total: price.total,
          ...(price.couponCode && { couponCode: price.couponCode }),
          paymentMethod: input.paymentMethod,
          demo: input.demo ?? env.DEMO_PAYMENTS,
          paymentStatus: "pending",
          orderStatus: "placed",
          ...(input.idempotencyKey && { idempotencyKey: input.idempotencyKey }),
        },
      ],
      session ? { session } : undefined,
    );
    if (!order) throw new Error("Order creation returned no document");
    return order;
  };

  const session = await mongoose.startSession();
  try {
    let order: InstanceType<typeof Order> | undefined;
    await session.withTransaction(async () => {
      order = await makeOrder(session);
    });
    if (order) return order;
    throw new Error("Order transaction completed without an order");
  } catch (error) {
    if (isDuplicateKey(error) && input.idempotencyKey) {
      const existing = await Order.findOne({ user: input.userId, idempotencyKey: input.idempotencyKey }).exec();
      if (existing) return existing;
    }
    if (!isTransactionsUnavailable(error)) throw error;
  } finally {
    await session.endSession();
  }

  const price = await calculateCartPrice(input.userId, input.items, input.couponCode);
  const decremented: Array<{ product: unknown; size: string; qty: number }> = [];
  let couponConsumed = false;
  try {
    await decrementStock(input.items);
    decremented.push(...price.items.map(({ product, size, qty }) => ({ product, size, qty })));
    if (price.couponCode) {
      await consumeCoupon(price.couponCode, input.userId);
      couponConsumed = true;
    }
    const [order] = await Order.create([
      {
        user: input.userId,
        items: price.items,
        address: {
          name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        },
        subtotal: price.subtotal,
        discount: price.discount,
        shipping: price.shipping,
        total: price.total,
        ...(price.couponCode && { couponCode: price.couponCode }),
        paymentMethod: input.paymentMethod,
        demo: input.demo ?? env.DEMO_PAYMENTS,
        paymentStatus: "pending",
        orderStatus: "placed",
        ...(input.idempotencyKey && { idempotencyKey: input.idempotencyKey }),
      },
    ]);
    if (!order) throw new Error("Order creation returned no document");
    return order;
  } catch (error) {
    if (couponConsumed && price.couponCode) await releaseCoupon(price.couponCode, input.userId);
    if (decremented.length) await restoreStock(decremented);
    if (isDuplicateKey(error) && input.idempotencyKey) {
      const existing = await Order.findOne({ user: input.userId, idempotencyKey: input.idempotencyKey }).exec();
      if (existing) return existing;
    }
    throw error;
  }
}

function aggregateQuantities(items: CartItemInput[]): Map<string, { productId: string; size: string; qty: number }> {
  const quantities = new Map<string, { productId: string; size: string; qty: number }>();
  for (const { productId, size, qty } of items) {
    const key = `${productId.toLowerCase()}\u0000${size}`;
    const item = quantities.get(key) ?? { productId, size, qty: 0 };
    item.qty += qty;
    quantities.set(key, item);
  }
  return quantities;
}

function aggregateOrderQuantities(
  items: Array<{ product: unknown; size: string; qty: number }>,
): Map<string, { productId: string; size: string; qty: number }> {
  const quantities = new Map<string, { productId: string; size: string; qty: number }>();
  for (const { product, size, qty } of items) {
    const id = String(product);
    const key = `${id.toLowerCase()}\u0000${size}`;
    const item = quantities.get(key) ?? { productId: id, size, qty: 0 };
    item.qty += qty;
    quantities.set(key, item);
  }
  return quantities;
}

function isTransactionsUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && [20, 303, 40573].includes(Number(error.code))) return true;
  if ("message" in error && typeof error.message === "string") {
    return /transaction numbers are only allowed|does not support transactions|replica set member or mongos/i.test(
      error.message,
    );
  }
  return false;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
