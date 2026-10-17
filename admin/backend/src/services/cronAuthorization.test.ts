import { describe, expect, it } from "vitest";
import { hasValidCronAuthorization } from "./cronAuthorization.js";

describe("cron bearer authorization", () => {
  it("accepts only the configured bearer secret", () => {
    expect(hasValidCronAuthorization("Bearer scheduled-secret", "scheduled-secret")).toBe(true);
    expect(hasValidCronAuthorization("Bearer other-secret", "scheduled-secret")).toBe(false);
    expect(hasValidCronAuthorization("scheduled-secret", "scheduled-secret")).toBe(false);
    expect(hasValidCronAuthorization(undefined, "scheduled-secret")).toBe(false);
    expect(hasValidCronAuthorization("Bearer scheduled-secret", undefined)).toBe(false);
  });
});
