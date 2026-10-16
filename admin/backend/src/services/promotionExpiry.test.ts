import { describe, expect, it, vi } from "vitest";
import { sweepExpiredPromotions, type ExpiryRepository, type ExpiryStore } from "./promotionExpiry.js";

describe("promotion expiry sweep", () => {
  it("deactivates due records and writes one audit record for each successful transition", async () => {
    const now = new Date("2026-10-16T10:01:00.000Z");
    const audit = vi.fn(async () => {});
    const discounts: ExpiryRepository = {
      findDueIds: vi.fn(async () => ["discount-1", "discount-raced"]),
      deactivate: vi.fn(async (id) => id === "discount-1"),
    };
    const coupons: ExpiryRepository = {
      findDueIds: vi.fn(async () => ["coupon-1"]),
      deactivate: vi.fn(async () => true),
    };
    const store: ExpiryStore = { discounts, coupons, audit };

    await expect(sweepExpiredPromotions(now, store)).resolves.toEqual({ discounts: 1, coupons: 1 });
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit).toHaveBeenNthCalledWith(1, "Discount", "discount-1", now);
    expect(audit).toHaveBeenNthCalledWith(2, "Coupon", "coupon-1", now);
  });
});
