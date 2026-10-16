import { describe, expect, it } from "vitest";

import { priceWithDiscounts, selectApplicableDiscounts, type DiscountCandidate } from "./discounts.js";

const now = new Date("2026-10-16T10:00:00.000Z");

function discount(
  id: string,
  overrides: Partial<DiscountCandidate> = {},
): DiscountCandidate {
  return {
    _id: id,
    name: id,
    scope: "sitewide",
    targets: [],
    type: "percent",
    value: 10,
    startsAt: new Date("2026-10-01T00:00:00.000Z"),
    endsAt: new Date("2026-11-01T00:00:00.000Z"),
    priority: 0,
    stackable: false,
    ...overrides,
  };
}

describe("active product discounts", () => {
  it("excludes discounts before their start and at or after their exclusive end", () => {
    const selected = selectApplicableDiscounts(
      [
        discount("not-started", { startsAt: new Date("2026-10-17T00:00:00.000Z"), priority: 3 }),
        discount("expired", { endsAt: now, priority: 2 }),
        discount("active", { priority: 1 }),
      ],
      { id: "product-1", category: "saree" },
      now,
    );

    expect(selected.map(({ name }) => name)).toEqual(["active"]);
  });

  it("includes a discount starting exactly now and excludes one ending exactly now", () => {
    const selected = selectApplicableDiscounts(
      [
        discount("starts-now", { startsAt: now }),
        discount("ends-now", { endsAt: now }),
      ],
      { id: "product-1", category: "saree" },
      now,
    );

    expect(selected.map(({ name }) => name)).toEqual(["starts-now"]);
  });

  it("selects the highest-priority overlapping discount with a stable ID tie-break", () => {
    const selected = selectApplicableDiscounts(
      [
        discount("b", { priority: 8 }),
        discount("c", { priority: 8 }),
        discount("a", { priority: 2 }),
      ],
      { id: "product-1", category: "saree" },
      now,
    );

    expect(selected.map(({ name }) => name)).toEqual(["b"]);
  });

  it("stacks only when every applied discount is stackable, in priority order", () => {
    const stackable = selectApplicableDiscounts(
      [
        discount("second", { priority: 2, value: 10, stackable: true }),
        discount("first", { priority: 3, value: 20, stackable: true }),
        discount("blocked", { priority: 1, value: 50, stackable: false }),
      ],
      { id: "product-1", category: "saree" },
      now,
    );
    const price = priceWithDiscounts(1000, stackable);

    expect(stackable.map(({ name }) => name)).toEqual(["first", "second"]);
    expect(price.price).toBe(720);
    expect(price.discountAmount).toBe(280);

    const nonStackable = selectApplicableDiscounts(
      [
        discount("highest", { priority: 3, value: 20, stackable: false }),
        discount("lower", { priority: 2, value: 50, stackable: true }),
      ],
      { id: "product-1", category: "saree" },
      now,
    );
    expect(nonStackable.map(({ name }) => name)).toEqual(["highest"]);
  });

  it("honors product/category/collection targets and caps each discount amount", () => {
    const selected = selectApplicableDiscounts(
      [
        discount("product", { scope: "product", targets: ["mayil-saree"], priority: 3, stackable: true }),
        discount("category", { scope: "category", targets: ["saree"], priority: 2, stackable: true }),
        discount("collection", { scope: "collection", targets: ["silk"], priority: 1, stackable: true }),
        discount("other-product", { scope: "product", targets: ["other"], priority: 4 }),
      ],
      { id: "product-id", slug: "mayil-saree", category: "saree", collection: "Silk" },
      now,
    );
    const capped = priceWithDiscounts(1000, [
      discount("cap", { type: "percent", value: 50, maxDiscount: 100 }),
    ]);

    expect(selected.map(({ name }) => name)).toEqual(["product", "category", "collection"]);
    expect(capped).toMatchObject({ price: 900, discountAmount: 100 });
  });
});
