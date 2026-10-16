import { describe, expect, it } from "vitest";
import { Order } from "./Order.js";
import { Product } from "./Product.js";

describe("sensitive model fields", () => {
  it("does not select internal order notes by default", () => {
    expect(Order.schema.path("adminNotes").options.select).toBe(false);
  });

  it("does not select product cost price by default", () => {
    expect(Product.schema.path("costPrice").options.select).toBe(false);
  });
});
