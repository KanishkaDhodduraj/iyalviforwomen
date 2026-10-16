import { describe, expect, it } from "vitest";

import { loadFrontendProducts } from "./frontendProductData.js";

describe("frontend product seed source", () => {
  it("loads the existing catalog and maps its categories and image references", async () => {
    const products = await loadFrontendProducts();

    expect(products).toHaveLength(61);
    expect(products.every((product) => product.price > 0 && product.colors.length > 0)).toBe(true);
    expect(products.some((product) => product.category === "Sarees")).toBe(true);
    expect(products.some((product) => product.category === "Kurtis")).toBe(true);
    expect(products.every((product) => product.image.startsWith("/assets/"))).toBe(true);
  });
});
