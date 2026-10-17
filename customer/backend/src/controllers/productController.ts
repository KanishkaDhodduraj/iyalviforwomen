import type { RequestHandler } from "express";
import type { SortOrder } from "mongoose";
import { z } from "zod";

import { HttpError } from "../middleware/errors.js";
import { Product } from "../models/Product.js";
import { findActiveDiscounts, priceWithDiscounts, selectApplicableDiscounts, type DiscountCandidate } from "../services/discounts.js";

export const productListQuery = z
  .object({
    category: z.enum(["saree", "kurti"]).optional(),
    subCategory: z.string().trim().max(80).optional(),
    fabric: z.string().trim().max(80).optional(),
    color: z.string().trim().max(60).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    search: z.string().trim().max(100).optional(),
    isNewArrival: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
    sort: z.enum(["price_asc", "price_desc", "newest"]).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const productSlugParams = z.object({ slug: z.string().min(1).max(200) }).strict();

export const listProducts: RequestHandler = async (request, response) => {
  const query = productListQuery.parse(request.query);
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
    throw new HttpError(400, "Invalid price range");
  }
  const filter: Record<string, unknown> = { isActive: true, archived: { $ne: true } };
  if (query.category) filter.category = query.category;
  if (query.subCategory) filter.subCategory = new RegExp(escapeRegex(query.subCategory), "i");
  if (query.fabric) filter.fabric = new RegExp(escapeRegex(query.fabric), "i");
  if (query.color) filter.colors = new RegExp(`^${escapeRegex(query.color)}$`, "i");
  if (query.isNewArrival !== undefined) filter.isNewArrival = query.isNewArrival;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.$expr = {
      $and: [
        ...(query.minPrice !== undefined ? [{ $gte: [{ $ifNull: ["$mrp", "$price"] }, query.minPrice] }] : []),
        ...(query.maxPrice !== undefined ? [{ $lte: [{ $ifNull: ["$mrp", "$price"] }, query.maxPrice] }] : []),
      ],
    };
  }
  if (query.search) filter.$text = { $search: query.search };
  const sort: Record<string, SortOrder> = {
    price_asc: { price: 1 as const, _id: 1 as const },
    price_desc: { price: -1 as const, _id: 1 as const },
    newest: { createdAt: -1 as const, _id: -1 as const },
  }[query.sort];
  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    Product.countDocuments(filter).exec(),
  ]);
  const activeDiscounts = products.some(hasPrice) ? await findActiveDiscounts() : [];
  response.json({
    products: products.map((product) => customerProduct(product, activeDiscounts)),
    page: query.page,
    limit: query.limit,
    total,
  });
};

export const getProduct: RequestHandler = async (request, response) => {
  const { slug } = productSlugParams.parse(request.params);
  const product = await Product.findOne({ slug, isActive: true, archived: { $ne: true } }).lean().exec();
  if (!product) throw new HttpError(404, "Product not found");
  const activeDiscounts = hasPrice(product) ? await findActiveDiscounts() : [];
  response.json({ product: customerProduct(product, activeDiscounts) });
};

type ProductRecord = Record<string, unknown> & {
  _id: unknown;
  category?: string | null;
  price?: number;
  mrp?: number;
};

function hasPrice(product: ProductRecord): product is ProductRecord & { price: number } {
  return typeof product.price === "number";
}

function customerProduct(product: ProductRecord, activeDiscounts: DiscountCandidate[]) {
  const result: Record<string, unknown> = {
    _id: product._id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    subCategory: product.subCategory,
    fabric: product.fabric,
    colors: Array.isArray(product.colors) && product.colors.length ? product.colors : ["Default"],
    sizes: customerSizes(product.sizes, Number(product.stock ?? 0)),
    sizeStock: customerSizeStock(product.sizes, Number(product.stock ?? 0)),
    inStock: Number(product.stock ?? 0) > 0,
    lowStock: Number(product.stock ?? 0) > 0 && Number(product.stock ?? 0) <= 5 ? Number(product.stock) : null,
    price: typeof product.mrp === "number" ? product.mrp : product.price,
    mrp: product.mrp,
    images: customerImages(product.images),
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    tags: product.tags,
  };
  if (!hasPrice(product)) return result;

  const selected = selectApplicableDiscounts(
    activeDiscounts,
    {
      id: String(product._id).toLowerCase(),
      ...(typeof product.slug === "string" && { slug: product.slug }),
      category: product.category ?? "",
      ...(typeof product.subCategory === "string" && { collection: product.subCategory }),
    },
  );
  const basePrice = typeof product.mrp === "number" ? product.mrp : product.price;
  const priced = priceWithDiscounts(basePrice, selected);
  result.price = priced.price;
  result.originalPrice = basePrice;
  const flashSaleEndsAt = selected
    .filter((discount) => discount.isFlashSale)
    .map((discount) => new Date(discount.endsAt).toISOString())
    .sort()[0];
  if (flashSaleEndsAt) result.offerEndsAt = flashSaleEndsAt;
  return result;
}

function customerImages(images: unknown): unknown[] {
  if (!Array.isArray(images)) return [];
  return images.map((image) => {
    if (typeof image === "string") return image;
    if (typeof image !== "object" || image === null) return null;
    const record = image as Record<string, unknown>;
    return {
      url: record.url,
      alt: record.alt,
      isPrimary: record.isPrimary,
      ...(typeof record.thumbnailUrl === "string" && { thumbnailUrl: record.thumbnailUrl }),
    };
  }).filter((image) => image !== null);
}

function customerSizes(sizes: unknown, stock: number): string[] {
  if (!Array.isArray(sizes) || sizes.length === 0) return stock > 0 ? ["One Size"] : [];
  return sizes.flatMap((size) => {
    if (typeof size === "string") return [size];
    if (typeof size !== "object" || size === null || !("size" in size)) return [];
    return typeof size.size === "string" ? [size.size] : [];
  });
}

function customerSizeStock(sizes: unknown, totalStock: number): Record<string, { inStock: boolean; lowStock: number | null }> {
  const variants = Array.isArray(sizes) ? sizes : [];
  if (variants.length === 0) {
    return {
      "One Size": {
        inStock: totalStock > 0,
        lowStock: totalStock > 0 && totalStock <= 5 ? totalStock : null,
      },
    };
  }
  return Object.fromEntries(variants.flatMap((variant) => {
    if (typeof variant === "string") {
      return [[variant, { inStock: totalStock > 0, lowStock: totalStock > 0 && totalStock <= 5 ? totalStock : null }]];
    }
    if (typeof variant !== "object" || variant === null || !("size" in variant) || !("stock" in variant)) return [];
    const { size, stock } = variant as { size: unknown; stock: unknown };
    if (typeof size !== "string" || typeof stock !== "number") return [];
    return [[size, { inStock: stock > 0, lowStock: stock > 0 && stock <= 5 ? stock : null }]];
  }));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
