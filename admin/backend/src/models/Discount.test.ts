import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Discount } from "./Discount.js";

function validDiscount(overrides: Record<string, unknown> = {}) {
  return new Discount({
    name: "Promotion",
    scope: "sitewide",
    targets: [],
    type: "percent",
    value: 20,
    startsAt: new Date("2026-10-16T10:00:00.000Z"),
    endsAt: new Date("2026-10-16T11:00:00.000Z"),
    createdBy: new mongoose.Types.ObjectId(),
    ...overrides,
  });
}

describe("admin discount model", () => {
  it("defaults flash sale state to false and accepts the 90% boundary", async () => {
    const item = validDiscount({ value: 90 });
    expect(item.isFlashSale).toBe(false);
    await expect(item.validate()).resolves.toBeUndefined();
  });

  it("rejects non-positive date windows", async () => {
    await expect(validDiscount({
      startsAt: new Date("2026-10-16T10:00:00.000Z"),
      endsAt: new Date("2026-10-16T10:00:00.000Z"),
    }).validate()).rejects.toThrow();
  });
});
