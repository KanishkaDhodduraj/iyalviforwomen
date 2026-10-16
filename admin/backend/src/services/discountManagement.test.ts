import { describe, expect, it } from "vitest";
import { discountStatus, previewDiscounts, serializeDiscount, type ManagedDiscount } from "./discountManagement.js";

const now = new Date("2026-10-16T10:00:00.000Z");

function discount(overrides: Partial<ManagedDiscount> = {}): ManagedDiscount {
  return {
    _id: "a",
    name: "Sale",
    scope: "sitewide",
    targets: [],
    type: "percent",
    value: 20,
    startsAt: "2026-10-16T10:00:00.000Z",
    endsAt: "2026-10-16T11:00:00.000Z",
    isActive: true,
    isFlashSale: false,
    priority: 0,
    stackable: false,
    ...overrides,
  };
}

describe("discount schedule status", () => {
  it("is active starting exactly at startsAt and expired at endsAt", () => {
    const item = discount();
    expect(discountStatus(item, now)).toBe("active");
    expect(discountStatus(item, new Date("2026-10-16T10:59:59.999Z"))).toBe("active");
    expect(discountStatus(item, new Date("2026-10-16T11:00:00.000Z"))).toBe("expired");
  });

  it("distinguishes scheduled and manually inactive discounts", () => {
    expect(discountStatus(discount({ startsAt: "2026-10-16T10:00:00.001Z" }), now)).toBe("scheduled");
    expect(discountStatus(discount({ isActive: false }), now)).toBe("inactive");
  });

  it("previews overlapping discounts by priority and only stacks a consecutive stackable group", () => {
    const result = previewDiscounts([
      discount({ _id: "low", name: "Lower", value: 50, priority: 1, stackable: true }),
      discount({ _id: "high", name: "Higher", value: 10, priority: 3, stackable: true }),
      discount({ _id: "middle", name: "Middle", type: "flat", value: 100, priority: 2, stackable: true }),
      discount({ _id: "stop", name: "Stop", value: 5, priority: 0, stackable: false }),
    ], { id: "p1", slug: "product-one", category: "saree", price: 1000 }, now);

    expect(result.price).toBe(400);
    expect(result.appliedDiscounts.map((item) => item.name)).toEqual(["Higher", "Middle", "Lower"]);
    expect(result.matchingDiscounts.find((item) => item.name === "Stop")?.applicable).toBe(false);
  });

  it("includes the UTC end time only for flash sales", () => {
    expect(serializeDiscount(discount({ isFlashSale: true }), now)).toMatchObject({
      isFlashSale: true,
      flashSaleEndsAt: "2026-10-16T11:00:00.000Z",
    });
    expect(serializeDiscount(discount(), now).flashSaleEndsAt).toBeNull();
  });
});
