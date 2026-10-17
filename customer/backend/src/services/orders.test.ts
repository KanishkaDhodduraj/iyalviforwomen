import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Address } from "../models/Address.js";
import { Discount } from "../models/Discount.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Setting } from "../models/Setting.js";
import { calculateCartPrice } from "./pricing.js";
import {
  decrementStock,
  allowedPaymentMethods,
  createOrderCreateBody,
  findOwnedOrder,
  isAllowedStatusTransition,
  orderCreateBody,
  reserveAndCreateOrder,
} from "./orders.js";

function mockDiscounts(discounts: unknown[] = []) {
  const query = {
    sort: vi.fn(() => query),
    lean: vi.fn(() => query),
    session: vi.fn(() => query),
    exec: vi.fn(async () => discounts),
  };
  vi.spyOn(Discount, "find").mockReturnValue(query as never);
}

describe("server-side cart pricing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Setting, "findById").mockReturnValue({
      select: () => ({
        lean: () => ({ exec: async () => null }),
      }),
    } as never);
  });

  it("recalculates subtotal and shipping from persisted product prices", async () => {
    const productId = new mongoose.Types.ObjectId();
    mockDiscounts();
    const productQuery = {
      session: vi.fn(() => productQuery),
      exec: async () => [
        {
          _id: productId,
          name: "Cotton Kurti",
          price: 600,
          stock: 10,
          sizes: [{ size: "M", stock: 10 }],
          colors: ["Indigo"],
        },
      ],
    };
    vi.spyOn(Product, "find").mockReturnValue(productQuery as never);

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

  it("recalculates discounted prices from active server discounts", async () => {
    const productId = new mongoose.Types.ObjectId();
    mockDiscounts([
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Seasonal",
        scope: "sitewide",
        targets: [],
        type: "percent",
        value: 20,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
        priority: 1,
        stackable: false,
      },
    ]);
    const productQuery = {
      session: vi.fn(() => productQuery),
      exec: async () => [
        {
          _id: productId,
          name: "Cotton Kurti",
          category: "kurti",
          price: 600,
          stock: 10,
          sizes: [{ size: "M", stock: 10 }],
          colors: ["Indigo"],
        },
      ],
    };
    vi.spyOn(Product, "find").mockReturnValue(productQuery as never);

    const result = await calculateCartPrice(undefined, [
      { productId: productId.toString(), size: "M", color: "Indigo", qty: 2 },
    ]);

    expect(result.items[0]).toMatchObject({
      unitPrice: 480,
      originalUnitPrice: 600,
      discountAmount: 240,
      discounts: [{ name: "Seasonal", amount: 120 }],
    });
    expect(result).toMatchObject({ subtotal: 1200, discount: 240, shipping: 99, total: 1059 });
  });

  it("checks stock for the requested size instead of trusting aggregate stock", async () => {
    const productId = new mongoose.Types.ObjectId();
    mockDiscounts();
    vi.spyOn(Product, "find").mockReturnValue({
      exec: async () => [
        {
          _id: productId,
          name: "Cotton Kurti",
          category: "kurti",
          price: 600,
          stock: 10,
          sizes: [
            { size: "M", stock: 0 },
            { size: "L", stock: 10 },
          ],
          colors: ["Indigo"],
        },
      ],
    } as never);

    await expect(
      calculateCartPrice(undefined, [
        { productId: productId.toString(), size: "M", color: "Indigo", qty: 1 },
      ]),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("prices a single-total-stock product through its One Size variant", async () => {
    const productId = new mongoose.Types.ObjectId();
    mockDiscounts();
    vi.spyOn(Product, "find").mockReturnValue({
      exec: async () => [{
        _id: productId,
        name: "One size wrap",
        price: 1200,
        mrp: 1200,
        stock: 3,
        sizes: [],
        colors: [],
      }],
    } as never);
    const result = await calculateCartPrice(undefined, [
      { productId: productId.toString(), size: "One Size", color: "Default", qty: 1 },
    ]);
    expect(result.items[0]).toMatchObject({ originalUnitPrice: 1200, unitPrice: 1200 });
  });

  it("snapshots the recalculated per-item discount in the created order", async () => {
    const productId = new mongoose.Types.ObjectId();
    const addressId = new mongoose.Types.ObjectId();
    const order = { _id: new mongoose.Types.ObjectId() };
    mockDiscounts([
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Order offer",
        scope: "sitewide",
        targets: [],
        type: "flat",
        value: 100,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
        priority: 10,
        stackable: false,
      },
    ]);
    vi.spyOn(Address, "findOne").mockReturnValue({
      lean: () => ({
        exec: async () => ({
          name: "Customer",
          phone: "9876543210",
          line1: "1 Main Street",
          line2: "",
          city: "Chennai",
          state: "Tamil Nadu",
          pincode: "600001",
        }),
      }),
    } as never);
    const productQuery = {
      session: vi.fn(() => productQuery),
      exec: async () => [
        {
          _id: productId,
          name: "Cotton Kurti",
          category: "kurti",
          price: 1200,
          stock: 3,
          sizes: [{ size: "M", stock: 3 }],
          colors: ["Indigo"],
        },
      ],
    };
    vi.spyOn(Product, "find").mockReturnValue(productQuery as never);
    vi.spyOn(Product, "updateOne").mockReturnValue({
      exec: async () => ({ modifiedCount: 1 }),
    } as never);
    const session = {
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: async () => undefined,
    };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session as never);
    const createOrder = vi.spyOn(Order, "create").mockResolvedValue([order] as never);

    await reserveAndCreateOrder({
      userId: new mongoose.Types.ObjectId().toString(),
      items: [{ productId: productId.toString(), size: "M", color: "Indigo", qty: 1 }],
      addressId: addressId.toString(),
      paymentMethod: "COD",
      demo: true,
    });

    expect(createOrder).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          subtotal: 1200,
          discount: 100,
          total: 1100,
          paymentStatus: "pending",
          demo: true,
          items: [
            expect.objectContaining({
              unitPrice: 1100,
              originalUnitPrice: 1200,
              discountAmount: 100,
              discounts: [expect.objectContaining({ name: "Order offer", amount: 100 })],
            }),
          ],
        }),
      ],
      { session },
    );
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
      {
        _id: productId.toString(),
        isActive: true,
        archived: { $ne: true },
        stock: { $gte: 3 },
        sizes: { $elemMatch: { size: "M", stock: { $gte: 3 } } },
      },
      { $inc: { stock: -3, "sizes.$.stock": -3 } },
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

  it("atomically decrements total stock for products without size variants", async () => {
    const productId = new mongoose.Types.ObjectId().toString();
    const updateOne = vi.spyOn(Product, "updateOne")
      .mockImplementationOnce(() => ({ exec: async () => ({ modifiedCount: 0 }) }) as never)
      .mockImplementationOnce(() => ({ exec: async () => ({ modifiedCount: 1 }) }) as never);
    await decrementStock([{ productId, size: "One Size", color: "Default", qty: 1 }]);
    expect(updateOne).toHaveBeenLastCalledWith(
      { _id: productId, isActive: true, archived: { $ne: true }, stock: { $gte: 1 }, sizes: { $size: 0 } },
      { $inc: { stock: -1 } },
      undefined,
    );
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
      cardNumber: "4111111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("accepts COD by default and only allows the four demo methods when enabled", () => {
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

    for (const paymentMethod of ["COD", "UPI", "CARD", "NETBANKING"]) {
      expect(createOrderCreateBody(true).safeParse({ ...orderBase, paymentMethod }).success).toBe(true);
      expect(createOrderCreateBody(false).safeParse({ ...orderBase, paymentMethod }).success)
        .toBe(paymentMethod === "COD");
    }
    expect(createOrderCreateBody(true).safeParse({ ...orderBase, paymentMethod: "RAZORPAY" }).success).toBe(
      false,
    );
    expect(createOrderCreateBody(false).safeParse(orderBase).data?.paymentMethod).toBe("COD");
    expect(allowedPaymentMethods(true)).toEqual(["COD", "UPI", "CARD", "NETBANKING"]);
    expect(allowedPaymentMethods(false)).toEqual(["COD"]);
  });
});
