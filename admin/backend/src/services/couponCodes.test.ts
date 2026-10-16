import { describe, expect, it } from "vitest";
import { generateUniqueCouponCodes } from "./couponCodes.js";

describe("bulk coupon code generation", () => {
  it("generates unique uppercase codes with the requested prefix", () => {
    const codes = generateUniqueCouponCodes(500, "summer-");
    expect(codes).toHaveLength(500);
    expect(new Set(codes).size).toBe(500);
    expect(codes.every((code) => /^SUMMER-[A-F0-9]{12}$/.test(code))).toBe(true);
  });
});
