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
    occasion: z.string().trim().max(60).optional(),
    color: z.string().trim().max(60).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    search: z.string().trim().max(100).optional(),
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
  if (query.occasion) filter.occasion = new RegExp(escapeRegex(query.occasion), "i");
  if (query.color) filter.colors = new RegExp(`^${escapeRegex(query.color)}$`, "i");
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {
      ...(query.minPrice !== undefined && { $gte: query.minPrice }),
      ...(query.maxPrice !== undefined && { $lte: query.maxPrice }),
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
  category?: string;
  price?: number;
  mrp?: number;
};

function hasPrice(product: ProductRecord): product is ProductRecord & { category: string; price: number } {
  return typeof product.price === "number" && typeof product.category === "string";
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
    occasion: product.occasion,
    colors: product.colors,
    sizes: customerSizes(product.sizes),
    price: product.price,
    mrp: product.mrp,
    images: customerImages(product.images),
    stock: product.stock,
    isFeatured: product.isFeatured,
    tags: product.tags,
  };
  if (!hasPrice(product)) return result;

  const selected = selectApplicableDiscounts(
    activeDiscounts,
    {
      id: String(product._id).toLowerCase(),
      ...(typeof product.slug === "string" && { slug: product.slug }),
      category: product.category,
      ...(typeof product.subCategory === "string" && { collection: product.subCategory }),
    },
  );
  const priced = priceWithDiscounts(product.price, selected);
  result.price = priced.price;
  result.originalPrice = Math.max(product.price, typeof product.mrp === "number" ? product.mrp : product.price);
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

function customerSizes(sizes: unknown): string[] {
  if (!Array.isArray(sizes)) return [];
  return sizes.flatMap((size) => {
    if (typeof size === "string") return [size];
    if (typeof size !== "object" || size === null || !("size" in size)) return [];
    return typeof size.size === "string" ? [size.size] : [];
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
