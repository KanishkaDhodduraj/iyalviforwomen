import { describe, expect, it } from "vitest";
import { productSlugBase } from "./productSlug.js";

describe("product slug generation", () => {
  it("generates a normalized slug from the product name", () => {
    expect(productSlugBase("  Silk Saree — Evening Edit! ")).toBe("silk-saree-evening-edit");
  });

  it("uses a stable fallback for names without latin letters or digits", () => {
    expect(productSlugBase("नमस्ते")).toBe("product");
  });
});
