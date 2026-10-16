import { describe, expect, it } from "vitest";
import { productInputSchema, productUpdateSchema } from "./product.js";

const validProduct = {
  slug: "summer-kurti",
  sku: "SKU-1",
  name: "Summer Kurti",
  description: "Light cotton",
  category: "kurti",
  subCategory: "casual",
  fabric: "cotton",
  occasion: "everyday",
  colors: ["blue"],
  sizes: [{ size: "M", stock: 4 }, { size: "L", stock: 2 }],
  price: 1000,
  mrp: 1200,
  costPrice: 400,
  images: [{ url: "/uploads/products/image.webp", key: "12345678-1234-1234-1234-123456789012.webp", alt: "Blue kurti", isPrimary: true }],
  tags: ["summer"],
  isActive: true,
  isFeatured: false,
};

describe("product management schemas", () => {
  it("accepts model-shaped sizes and embedded images with defaults", () => {
    const parsed = productInputSchema.parse(validProduct);
    expect(parsed.sizes[0]).toEqual({ size: "M", stock: 4 });
    expect(parsed.images[0]).toMatchObject({ key: validProduct.images[0].key, alt: "Blue kurti", isPrimary: true });
    expect(parsed.archived).toBe(false);
  });

  it("rejects duplicate sizes, multiple primary images, and costs in legacy shapes", () => {
    expect(productInputSchema.safeParse({ ...validProduct, sizes: [{ size: "M", stock: 1 }, { size: "m", stock: 2 }] }).success).toBe(false);
    expect(productInputSchema.safeParse({
      ...validProduct,
      images: [...validProduct.images, { ...validProduct.images[0], url: "/second.webp" }],
    }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validProduct, sizes: ["M", "L"] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validProduct, images: ["/image.webp"] }).success).toBe(false);
  });

  it("requires exactly one primary image and unique local image keys", () => {
    expect(productInputSchema.safeParse({
      ...validProduct,
      images: [{ ...validProduct.images[0], isPrimary: false }],
    }).success).toBe(false);
    expect(productInputSchema.safeParse({
      ...validProduct,
      images: [validProduct.images[0], { ...validProduct.images[0], url: "/second.webp", isPrimary: false }],
    }).success).toBe(false);
  });

  it("strictly accepts only partial model-shaped updates", () => {
    expect(productUpdateSchema.safeParse({ isFeatured: true, costPrice: 500 }).success).toBe(true);
    expect(productUpdateSchema.safeParse({ stock: 4 }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ isActive: true, unknown: true }).success).toBe(false);
  });
});
