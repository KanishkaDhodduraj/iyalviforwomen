import { describe, expect, it } from "vitest";

import { environmentSchema } from "./envSchema.js";

const baseEnvironment = {
  DATABASE_URL: "mongodb://localhost:27017/iyalvi-test",
  JWT_SECRET: "test-only-secret-that-is-at-least-32-characters",
  CLIENT_URL: "http://localhost:8080",
};

describe("DEMO_PAYMENTS environment option", () => {
  it("defaults to disabled", () => {
    expect(environmentSchema.parse(baseEnvironment).DEMO_PAYMENTS).toBe(false);
  });

  it.each([
    ["true", true],
    ["false", false],
  ])("parses %s", (value, expected) => {
    expect(environmentSchema.parse({ ...baseEnvironment, DEMO_PAYMENTS: value }).DEMO_PAYMENTS)
      .toBe(expected);
  });

  it("rejects other values", () => {
    expect(environmentSchema.safeParse({ ...baseEnvironment, DEMO_PAYMENTS: "yes" }).success).toBe(false);
  });
});
