import { describe, expect, it } from "vitest";

import { validateClearProductsCommand } from "./clearProductsCommand.js";

describe("clear products confirmation guard", () => {
  it("refuses production regardless of the confirmation argument", () => {
    expect(() => validateClearProductsCommand("production", ["DELETE PRODUCTS"]))
      .toThrow("disabled in production");
  });

  it("requires the exact single confirmation argument", () => {
    expect(() => validateClearProductsCommand("development", [])).toThrow("exact confirmation");
    expect(() => validateClearProductsCommand("development", ["DELETE"])).toThrow("exact confirmation");
    expect(() => validateClearProductsCommand("development", ["DELETE PRODUCTS", "extra"]))
      .toThrow("exact confirmation");
    expect(() => validateClearProductsCommand("development", ["DELETE PRODUCTS"])).not.toThrow();
  });
});
