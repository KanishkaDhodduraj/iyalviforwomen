import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { calculateCartPrice } from "./pricing.js";
import {
  decrementStock,
  findOwnedOrder,
  isAllowedStatusTransition,
  orderCreateBody,
} from "./orders.js";

describe("server-side cart pricing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("recalculates subtotal and shipping from persisted product prices", async () => {
    const productId = new mongoose.Types.ObjectId();
    vi.spyOn(Product, "find").mockReturnValue({
      exec: async () => [
        {
          _id: productId,
          name: "Cotton Kurti",
          price: 600,
          stock: 10,
          sizes: ["M"],
          colors: ["Indigo"],
        },
      ],
    } as never);

    const result = await calculateCartPrice(
      new mongoose.Types.ObjectId().toString(),
      [{ productId: productId.toString(), size: "M", color: "Indigo", qty: 2 }],
    );

    expect(result.subtotal).toBe(1200);
    expect(result.shipping).toBe(0);
    expect(result.total).toBe(1200);
    expect(result.items[0]?.unitPrice).toBe(600);
  });

  it("rejects an unavailable product instead of pricing a client-supplied price", async () => {
    vi.spyOn(Product, "find").mockReturnValue({ exec: async () => [] } as never);

    await expect(
      calculateCartPrice(new mongoose.Types.ObjectId().toString(), [
        { productId: new mongoose.Types.ObjectId().toString(), size: "M", color: "Red", qty: 1 },
      ]),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("atomic stock reservations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("can decrement the last available units to exactly zero", async () => {
    const productId = new mongoose.Types.ObjectId();
    let stock = 3;
    const updateOne = vi.spyOn(Product, "updateOne").mockImplementation((_filter: unknown, update: unknown) => {
      const delta = (update as { $inc: { stock: number } }).$inc.stock;
      stock += delta;
      return { exec: async () => ({ modifiedCount: 1 }) } as never;
    });

    await decrementStock([{ productId: productId.toString(), size: "M", color: "Red", qty: 3 }]);

    expect(stock).toBe(0);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: productId.toString(), isActive: true, stock: { $gte: 3 } },
      { $inc: { stock: -3 } },
      undefined,
    );
  });

  it("fails if a concurrent buyer has exhausted the stock", async () => {
    vi.spyOn(Product, "updateOne").mockImplementation(
      () => ({ exec: async () => ({ modifiedCount: 0 }) }) as never,
    );

    await expect(
      decrementStock([{ productId: new mongoose.Types.ObjectId().toString(), size: "M", color: "Red", qty: 1 }]),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("restores earlier decrements when a later product cannot be reserved", async () => {
    const firstId = new mongoose.Types.ObjectId().toString();
    const secondId = new mongoose.Types.ObjectId().toString();
    const stock = new Map([
      [firstId, 1],
      [secondId, 0],
    ]);
    vi.spyOn(Product, "updateOne").mockImplementation((filter: unknown, update: unknown) => {
      const id = (filter as { _id: string })._id;
      const delta = (update as { $inc: { stock: number } }).$inc.stock;
      if (delta < 0 && (stock.get(id) ?? 0) < -delta) {
        return { exec: async () => ({ modifiedCount: 0 }) } as never;
      }
      stock.set(id, (stock.get(id) ?? 0) + delta);
      return { exec: async () => ({ modifiedCount: 1 }) } as never;
    });

    await expect(
      decrementStock([
        { productId: firstId, size: "M", color: "Red", qty: 1 },
        { productId: secondId, size: "M", color: "Blue", qty: 1 },
      ]),
    ).rejects.toMatchObject({ status: 409 });
    expect(stock.get(firstId)).toBe(1);
    expect(stock.get(secondId)).toBe(0);
  });
});

describe("order ownership and transitions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 for an order that is not owned by the user", async () => {
    vi.spyOn(Order, "findOne").mockReturnValue({ exec: async () => null } as never);

    await expect(
      findOwnedOrder(new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("allows only the next forward order status", () => {
    expect(isAllowedStatusTransition("placed", "packed")).toBe(true);
    expect(isAllowedStatusTransition("placed", "shipped")).toBe(false);
    expect(isAllowedStatusTransition("delivered", "cancelled")).toBe(false);
  });

  it("rejects prices, totals, user IDs, and payment details from order input", () => {
    const productId = new mongoose.Types.ObjectId().toString();
    const addressId = new mongoose.Types.ObjectId().toString();
    const result = orderCreateBody.safeParse({
      items: [{ productId, size: "M", color: "Red", qty: 1, unitPrice: 1 }],
      addressId,
      paymentMethod: "COD",
      userId: new mongoose.Types.ObjectId().toString(),
      total: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all four demo checkout methods without accepting gateway-specific values", () => {
    const orderBase = {
      items: [
        {
          productId: new mongoose.Types.ObjectId().toString(),
          size: "M",
          color: "Red",
          qty: 1,
        },
      ],
      addressId: new mongoose.Types.ObjectId().toString(),
    };

    for (const paymentMethod of ["COD", "UPI", "CARD", "NET_BANKING"]) {
      expect(orderCreateBody.safeParse({ ...orderBase, paymentMethod }).success).toBe(true);
    }
    expect(orderCreateBody.safeParse({ ...orderBase, paymentMethod: "RAZORPAY" }).success).toBe(
      false,
    );
  });
});
