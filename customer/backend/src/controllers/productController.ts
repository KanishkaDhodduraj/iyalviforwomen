import type { RequestHandler } from "express";
import type { SortOrder } from "mongoose";
import { z } from "zod";

import { HttpError } from "../middleware/errors.js";
import { Product } from "../models/Product.js";

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
  const filter: Record<string, unknown> = { isActive: true };
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
  response.json({ products, page: query.page, limit: query.limit, total });
};

export const getProduct: RequestHandler = async (request, response) => {
  const { slug } = productSlugParams.parse(request.params);
  const product = await Product.findOne({ slug, isActive: true }).lean().exec();
  if (!product) throw new HttpError(404, "Product not found");
  response.json({ product });
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
