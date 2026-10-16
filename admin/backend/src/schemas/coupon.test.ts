import { describe, expect, it } from "vitest";
import {
  couponGenerationSchema,
  couponInputSchema,
  couponUpdateSchema,
  couponUsageQuerySchema,
} from "./coupon.js";

const valid = {
  code: "SAVE20",
  type: "percent",
  value: 20,
  expiresAt: "2026-11-01T00:00:00.000Z",
  usageLimit: 100,
};

describe("coupon schemas", () => {
  it("normalizes codes and validates discount percentages", () => {
    expect(couponInputSchema.parse({ ...valid, code: " save20 " })).toMatchObject({
      code: "SAVE20",
      minOrder: 0,
      perUserLimit: 1,
    });
    expect(couponInputSchema.safeParse({ ...valid, value: 0.99 }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...valid, value: 90 }).success).toBe(true);
    expect(couponInputSchema.safeParse({ ...valid, value: 91 }).success).toBe(false);
  });

  it("requires explicit UTC offsets for expiry storage and usage date filters", () => {
    expect(couponInputSchema.safeParse({ ...valid, expiresAt: "2026-11-01T00:00:00" }).success).toBe(false);
    expect(couponUsageQuerySchema.safeParse({ from: "2026-10-01T00:00:00Z", to: "2026-10-31T23:59:59+00:00" }).success).toBe(true);
    expect(couponUsageQuerySchema.safeParse({
      from: "2026-10-16T09:30:00+02:00",
      to: "2026-10-16T08:00:00Z",
    }).success).toBe(true);
    expect(couponUsageQuerySchema.safeParse({ from: "2026-10-01T00:00:00" }).success).toBe(false);
    expect(couponUsageQuerySchema.safeParse({
      from: "2026-11-01T00:00:00Z",
      to: "2026-10-01T00:00:00Z",
    }).success).toBe(false);
  });

  it("validates bulk-generation bounds and accepts only code overrides when duplicating", () => {
    const generation = {
      type: valid.type,
      value: valid.value,
      expiresAt: valid.expiresAt,
      usageLimit: valid.usageLimit,
    };
    expect(couponGenerationSchema.parse({ ...generation, prefix: "summer-", count: 500 }).prefix).toBe("SUMMER-");
    expect(couponGenerationSchema.safeParse({ ...generation, count: 500 }).success).toBe(true);
    expect(couponGenerationSchema.safeParse({ ...generation, count: 501 }).success).toBe(false);
    expect(couponUpdateSchema.safeParse({ value: 30 }).success).toBe(true);
    expect(couponUpdateSchema.safeParse({ ignored: true }).success).toBe(false);
  });
});
