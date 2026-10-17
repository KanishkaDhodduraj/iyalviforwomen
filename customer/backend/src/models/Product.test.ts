import { describe, expect, it } from "vitest";

import { Product } from "./Product.js";

describe("customer product model", () => {
  it("supports embedded gallery images in their array order with local-storage metadata", async () => {
    const product = new Product({
      slug: "gallery-product",
      name: "Gallery product",
      category: "saree",
      subCategory: "Silk",
      fabric: "Silk",
      colors: ["Red"],
      sizes: [{ size: "Free Size", stock: 2 }],
      price: 1000,
      mrp: 1200,
      images: [
        {
          url: "/uploads/primary.webp",
          key: "11111111-1111-4111-8111-111111111111.webp",
          publicId: "products/primary",
          alt: "Front of the saree",
          isPrimary: true,
          thumbnailUrl: "/uploads/thumb-primary.webp",
          thumbnailKey: "11111111-1111-4111-8111-111111111111-thumb.webp",
        },
        {
          url: "/uploads/detail.webp",
          key: "22222222-2222-4222-8222-222222222222.webp",
          publicId: "products/detail",
          alt: "Saree border detail",
          isPrimary: false,
        },
      ],
      stock: 2,
    });

    await expect(product.validate()).resolves.toBeUndefined();
    expect(product.images.map(({ url }) => url)).toEqual([
      "/uploads/primary.webp",
      "/uploads/detail.webp",
    ]);
    expect(product.stock).toBe(2);
    expect(product.archived).toBe(false);
    expect(Product.schema.path("costPrice")?.options.select).toBe(false);
  });
});
