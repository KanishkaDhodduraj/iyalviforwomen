import { describe, expect, it } from "vitest";
import { discountInputSchema, discountUpdateSchema, discountUtcInputSchema } from "./discount.js";

const valid = {
  name: "Spring promotion",
  scope: "product",
  targets: ["product-id"],
  type: "percent",
  value: 20,
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-11-01T00:00:00.000Z",
};

describe("discount request schemas", () => {
  it("accepts the scoped discount shape and supplies operational defaults", () => {
    expect(discountInputSchema.parse(valid)).toMatchObject({
      name: valid.name,
      scope: valid.scope,
      targets: valid.targets,
      type: valid.type,
      value: valid.value,
      startsAt: new Date(valid.startsAt),
      endsAt: new Date(valid.endsAt),
      isActive: true,
      priority: 0,
      stackable: false,
      isFlashSale: false,
    });
  });

  it("requires targets for targeted scopes and prohibits targets sitewide", () => {
    expect(discountInputSchema.safeParse({ ...valid, targets: [] }).success).toBe(false);
    expect(discountInputSchema.safeParse({ ...valid, scope: "sitewide", targets: ["product-id"] }).success).toBe(false);
    expect(discountInputSchema.safeParse({ ...valid, scope: "sitewide", targets: [] }).success).toBe(true);
  });

  it("validates dates and the 1-90 percentage range", () => {
    expect(discountInputSchema.safeParse({ ...valid, endsAt: "2026-09-01T00:00:00.000Z" }).success).toBe(false);
    expect(discountInputSchema.safeParse({ ...valid, value: 0.99 }).success).toBe(false);
    expect(discountInputSchema.safeParse({ ...valid, value: 90.01 }).success).toBe(false);
    expect(discountInputSchema.safeParse({ ...valid, value: 90 }).success).toBe(true);
  });

  it("requires explicit timezone offsets for persisted UTC schedule dates", () => {
    expect(discountUtcInputSchema.safeParse(valid).success).toBe(true);
    expect(discountUtcInputSchema.safeParse({
      ...valid,
      startsAt: "2026-10-01T00:00:00",
    }).success).toBe(false);
  });

  it("defaults flash sale state to false and accepts an enabled flash sale", () => {
    expect(discountInputSchema.parse(valid).isFlashSale).toBe(false);
    expect(discountInputSchema.parse({ ...valid, isFlashSale: true }).isFlashSale).toBe(true);
  });

  it("rejects legacy coupon-shaped fields and permits partial updates", () => {
    expect(discountInputSchema.safeParse({ ...valid, code: "SAVE20", usageLimit: 100 }).success).toBe(false);
    expect(discountUpdateSchema.safeParse({ priority: 10, stackable: true }).success).toBe(true);
    expect(discountUpdateSchema.safeParse({ usageLimit: 100 }).success).toBe(false);
  });
});
