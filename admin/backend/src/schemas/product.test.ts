import { describe, expect, it } from "vitest";
import { productInputSchema, productUpdateSchema } from "./product.js";

describe("product management schemas", () => {
  it("requires only a name and MRP and supplies optional-field defaults", () => {
    const parsed = productInputSchema.parse({ name: "Summer Kurti", mrp: 1200 });
    expect(parsed).toMatchObject({
      name: "Summer Kurti",
      mrp: 1200,
      sizes: [],
      colors: [],
      images: [],
      isActive: true,
      isNewArrival: false,
    });
    expect(parsed).not.toHaveProperty("slug");
    expect(parsed).not.toHaveProperty("price");
  });

  it("accepts one total stock value or distinct size stock, but not both", () => {
    expect(productInputSchema.safeParse({ name: "Saree", mrp: 1200, stock: 12 }).success).toBe(true);
    expect(productInputSchema.safeParse({ name: "Saree", mrp: 1200, sizes: [{ size: "M", stock: 4 }] }).success).toBe(true);
    expect(productInputSchema.safeParse({
      name: "Saree",
      mrp: 1200,
      stock: 12,
      sizes: [{ size: "M", stock: 4 }],
    }).success).toBe(false);
    expect(productInputSchema.safeParse({
      name: "Saree",
      mrp: 1200,
      sizes: [{ size: "M", stock: 1 }, { size: "m", stock: 2 }],
    }).success).toBe(false);
  });

  it("validates optional images and their primary key constraints", () => {
    const image = { url: "/uploads/products/image.webp", key: "12345678-1234-1234-1234-123456789012.webp", alt: "Blue kurti", isPrimary: true };
    expect(productInputSchema.safeParse({ name: "Kurti", mrp: 1200, images: [image] }).success).toBe(true);
    expect(productInputSchema.safeParse({ name: "Kurti", mrp: 1200, images: [{ ...image, isPrimary: false }] }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: "Kurti", mrp: 1200, slug: "provided-slug" }).success).toBe(false);
  });

  it("accepts only partial updates and rejects unknown fields", () => {
    expect(productUpdateSchema.safeParse({ stock: 4 }).success).toBe(true);
    expect(productUpdateSchema.safeParse({ isFeatured: true, costPrice: 500 }).success).toBe(true);
    expect(productUpdateSchema.safeParse({ isActive: true, unknown: true }).success).toBe(false);
  });
});
