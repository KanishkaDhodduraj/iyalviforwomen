import type { RequestHandler } from "express";
import mongoose from "mongoose";

import { env } from "../config/env.js";
import { HttpError } from "../middleware/errors.js";
import { Order } from "../models/Order.js";
import { authUserId } from "../services/sessions.js";
import {
  adminOrderQuery,
  findOwnedOrder,
  isAllowedStatusTransition,
  orderCreateBody,
  orderIdParams,
  orderListQuery,
  orderStatusBody,
  reserveAndCreateOrder,
  restoreStock,
} from "../services/orders.js";
import { releaseCoupon } from "../services/pricing.js";

export const createOrder: RequestHandler = async (request, response) => {
  const body = orderCreateBody.parse(request.body);
  const rawIdempotencyKey = request.get("Idempotency-Key");
  if (rawIdempotencyKey && !/^[\w.:-]{1,128}$/.test(rawIdempotencyKey)) {
    throw new HttpError(400, "Invalid Idempotency-Key");
  }
  const order = await reserveAndCreateOrder({
    userId: authUserId(request),
    items: body.items,
    addressId: body.addressId,
    paymentMethod: body.paymentMethod,
    demo: env.DEMO_PAYMENTS,
    ...(body.couponCode && { couponCode: body.couponCode }),
    ...(rawIdempotencyKey && { idempotencyKey: rawIdempotencyKey }),
  });
  response.status(201).json({ order, demo: order.demo });
};

export const listOrders: RequestHandler = async (request, response) => {
  const { page, limit } = orderListQuery.parse(request.query);
  const user = authUserId(request);
  const [orders, total] = await Promise.all([
    Order.find({ user }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Order.countDocuments({ user }).exec(),
  ]);
  response.json({ orders, page, limit, total });
};

export const getOrder: RequestHandler = async (request, response) => {
  const { id } = orderIdParams.parse(request.params);
  const order = await findOwnedOrder(id, authUserId(request));
  response.json({ order });
};

export const cancelOrder: RequestHandler = async (request, response) => {
  const { id } = orderIdParams.parse(request.params);
  const user = authUserId(request);
  const session = await mongoose.startSession();
  try {
    let cancelled: InstanceType<typeof Order> | undefined;
    await session.withTransaction(async () => {
      cancelled = await cancelOrderData(id, user, session);
    });
    if (!cancelled) throw new Error("Order cancellation transaction returned no order");
    response.json({ order: cancelled });
  } catch (error) {
    if (!isTransactionsUnavailable(error)) throw error;
    response.json({ order: await cancelOrderData(id, user) });
  } finally {
    await session.endSession();
  }
};

export const listAdminOrders: RequestHandler = async (request, response) => {
  const { page, limit, status } = adminOrderQuery.parse(request.query);
  const filter = status ? { orderStatus: status } : {};
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Order.countDocuments(filter).exec(),
  ]);
  response.json({ orders, page, limit, total });
};

export const updateOrderStatus: RequestHandler = async (request, response) => {
  const { id } = orderIdParams.parse(request.params);
  const { status } = orderStatusBody.parse(request.body);
  const order = await Order.findById(id).select("orderStatus paymentMethod").lean().exec();
  if (!order) throw new HttpError(404, "Order not found");
  if (!isAllowedStatusTransition(order.orderStatus, status)) {
    throw new HttpError(409, "Invalid order status transition");
  }
  const update = {
    $set: {
      orderStatus: status,
      ...(status === "delivered" && order.paymentMethod === "COD" && { paymentStatus: "paid" }),
    },
  };
  const updated = await Order.findOneAndUpdate(
    { _id: id, orderStatus: order.orderStatus },
    update,
    { new: true, runValidators: true },
  ).exec();
  if (!updated) throw new HttpError(409, "Invalid order status transition");
  response.json({ order: updated });
};

async function cancelOrderData(
  id: string,
  user: string,
  session?: mongoose.ClientSession,
): Promise<InstanceType<typeof Order>> {
  const orderQuery = Order.findOneAndUpdate(
    { _id: id, user, orderStatus: "placed" },
    { $set: { orderStatus: "cancelled" } },
    { new: true, ...(session && { session }) },
  );
  const order = await orderQuery.exec();
  if (!order) {
    const existsQuery = Order.exists({ _id: id, user });
    if (session) existsQuery.session(session);
    const exists = await existsQuery.exec();
    throw new HttpError(exists ? 409 : 404, exists ? "Order cannot be cancelled" : "Order not found");
  }
  try {
    await restoreStock(order.items, session);
    if (order.couponCode) await releaseCoupon(order.couponCode, user, session);
  } catch (error) {
    if (!session) {
      await Order.updateOne(
        { _id: order._id, orderStatus: "cancelled" },
        { $set: { orderStatus: "placed" } },
      ).exec();
    }
    throw error;
  }
  return order;
}

function isTransactionsUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && [20, 303, 40573].includes(Number(error.code))) return true;
  return (
    "message" in error &&
    typeof error.message === "string" &&
    /transaction numbers are only allowed|does not support transactions|replica set member or mongos/i.test(
      error.message,
    )
  );
}
