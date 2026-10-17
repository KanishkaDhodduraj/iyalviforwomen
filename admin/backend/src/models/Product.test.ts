import { describe, expect, it } from "vitest";
import { Product } from "./Product.js";

const validProduct = () => new Product({
  slug: "saree-rose-handloom",
  sku: "IY-SAR-001",
  name: "Rose handloom saree",
  description: "A handloom cotton saree.",
  category: "saree",
  subCategory: "Handloom",
  fabric: "Cotton",
  colors: ["Rose"],
  sizes: [{ size: "Free", stock: 4 }],
  price: 2400,
  mrp: 2800,
  costPrice: 1100,
  images: [{
    url: "/uploads/products/123e4567-e89b-42d3-a456-426614174000.webp",
    key: "123e4567-e89b-42d3-a456-426614174000.webp",
    publicId: "123e4567-e89b-42d3-a456-426614174000.webp",
    alt: "Rose saree",
    isPrimary: true,
  }],
  tags: ["handloom", "festive"],
  isActive: true,
  isFeatured: false,
});

describe("Product model validation", () => {
  it("derives aggregate stock from the per-size stock values", async () => {
    const product = validProduct();
    product.sizes.push({ size: "M", stock: 3 });
    await product.validate();
    expect(product.stock).toBe(7);
  });

  it("rejects duplicate size labels and duplicate image keys", async () => {
    const product = validProduct();
    product.sizes.push({ size: "free", stock: 2 });
    product.images.push({ ...product.images[0]!.toObject(), isPrimary: false });
    await expect(product.validate()).rejects.toBeDefined();
  });

  it("keeps cost price excluded from normal model queries", () => {
    expect(Product.schema.path("costPrice")?.options.select).toBe(false);
  });
});
