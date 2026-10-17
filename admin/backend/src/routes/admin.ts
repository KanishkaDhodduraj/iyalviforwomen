import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAdmin, requireCsrf, requireRole } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { Address } from "../models/Address.js";
import { AuditLog } from "../models/AuditLog.js";
import { Coupon } from "../models/Coupon.js";
import { CouponRedemption } from "../models/CouponRedemption.js";
import { Discount } from "../models/Discount.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { Wishlist } from "../models/Wishlist.js";
import { emptyBody, emptyQuery } from "../middleware/validation.js";
import { canCancelOrder, canTransitionOrderStatus } from "../services/orderWorkflow.js";
import {
  discountDuplicateSchema,
  discountInputSchema,
  discountUtcInputSchema,
  discountUtcUpdateSchema,
} from "../schemas/discount.js";
import {
  couponDuplicateSchema,
  couponGenerationSchema,
  couponInputSchema,
  couponUpdateSchema,
  couponUsageQuerySchema,
  utcDateTimeSchema,
} from "../schemas/coupon.js";
import { productInputSchema, productUpdateSchema, productUpdateCandidateSchema } from "../schemas/product.js";
import { deleteImageAssetsWhenUnused } from "../services/imageStorage.js";
import { generateUniqueCouponCodes } from "../services/couponCodes.js";
import { productSlugBase } from "../services/productSlug.js";
import { previewDiscounts, serializeDiscount, type ManagedDiscount } from "../services/discountManagement.js";
import { messagesRouter } from "./messages.js";
import { reelsRouter } from "./reels.js";
import { reviewsRouter } from "./reviews.js";

export const adminRouter = Router();
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function uniqueProductSlug(name: string, excludedId?: string) {
  const base = productSlugBase(name);
  let slug = base;
  let suffix = 2;
  while (await Product.exists({ slug, ...(excludedId && { _id: { $ne: excludedId } }) })) {
    slug = `${base.slice(0, 150 - String(suffix).length)}-${suffix}`;
    suffix += 1;
  }
  return slug;
}
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
const statusBody = z.object({
  status: z.enum(["packed", "shipped", "out_for_delivery", "delivered"]),
  courier: z.string().trim().max(120).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
}).strict();
const orderListQuery = pageSchema.extend({
  status: z.enum(["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  paymentMethod: z.enum(["COD", "UPI", "CARD", "NETBANKING"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  customerId: idSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  minAmount: z.coerce.number().finite().min(0).optional(),
  maxAmount: z.coerce.number().finite().min(0).optional(),
  sortBy: z.enum(["createdAt", "total", "orderStatus"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", message: "Invalid order date range", path: ["to"] });
  }
  if (value.minAmount !== undefined && value.maxAmount !== undefined && value.minAmount > value.maxAmount) {
    context.addIssue({ code: "custom", message: "Invalid amount range", path: ["maxAmount"] });
  }
});
const orderActionNote = z.object({ note: z.string().trim().min(1).max(1000) }).strict();
const trackingBody = z.object({
  trackingNumber: z.string().trim().min(1).max(120),
  courier: z.string().trim().min(1).max(120),
}).strict();
const customerListQuery = pageSchema.extend({
  search: z.string().trim().max(120).optional(),
  isBlocked: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["createdAt", "name", "lifetimeValue", "totalOrders"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();
const blockBody = z.object({ isBlocked: z.boolean() }).strict();

function couponStatus(coupon: { isActive: boolean; startsAt?: Date | string; expiresAt: Date | string }, now = new Date()) {
  if (new Date(coupon.expiresAt).getTime() <= now.getTime()) return "expired" as const;
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now.getTime()) return "scheduled" as const;
  return coupon.isActive ? "active" as const : "inactive" as const;
}

function serializeCoupon<T extends { isActive: boolean; startsAt?: Date | string; expiresAt: Date | string }>(coupon: T, now = new Date()) {
  return { ...coupon, status: couponStatus(coupon, now) };
}

async function flatDiscountValidationMessage(input: {
  scope: string;
  targets: string[];
  type: string;
  value: number;
}): Promise<string | undefined> {
  if (input.type !== "flat") return undefined;
  const filter: Record<string, unknown> = { archived: { $ne: true } };
  if (input.scope === "product") {
    const objectIds = input.targets.filter((target) => mongoose.isValidObjectId(target));
    filter.$or = [{ _id: { $in: objectIds } }, { slug: { $in: input.targets } }];
  } else if (input.scope === "category") {
    filter.category = { $in: input.targets };
  } else if (input.scope === "collection") {
    filter.tags = { $in: input.targets };
  }
  const matchingProduct = await Product.findOne(filter).select("_id").lean().exec();
  if (!matchingProduct && input.scope === "product") return "No products match the discount targets";
  const underpricedProduct = await Product.findOne({
    ...filter,
    $expr: { $lte: [{ $ifNull: ["$mrp", "$price"] }, input.value] },
  }).select("_id").lean().exec();
  if (underpricedProduct) return "Flat discount must be below every matching product price";
  return undefined;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
const discountPreviewBody = z.object({
  productId: z.string().trim().min(1).max(160),
  asOf: utcDateTimeSchema.optional(),
}).strict();
const refundBody = z.object({
  amount: z.number().finite().positive(),
  note: z.string().trim().min(1).max(1000),
}).strict();
const productListQuery = pageSchema.extend({
  search: z.string().trim().min(1).max(120).optional(),
  category: z.enum(["saree", "kurti"]).optional(),
  subCategory: z.string().trim().max(100).optional(),
  fabric: z.string().trim().max(100).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  isFeatured: z.enum(["true", "false"]).optional(),
  archived: z.enum(["true", "false"]).optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "price", "stock"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict().superRefine((value, context) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice) {
    context.addIssue({ code: "custom", message: "Invalid price range", path: ["maxPrice"] });
  }
});
const duplicateProductBody = z.object({}).strict();
const linkedProductDiscountBody = z.object({
  type: z.enum(["percent", "flat"]),
  value: z.number().finite().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
}).strict().superRefine((value, context) => {
  if (value.endsAt <= value.startsAt) context.addIssue({ code: "custom", message: "End time must be after start time", path: ["endsAt"] });
  if (value.type === "percent" && (value.value < 1 || value.value > 90)) context.addIssue({ code: "custom", message: "Percentage must be between 1 and 90", path: ["value"] });
});
const stockUpdateBody = z.object({
  size: z.string().trim().min(1).max(40),
  stock: z.number().int().min(0).max(1_000_000),
}).strict();
const bulkProductBody = z.object({
  ids: z.array(idSchema).min(1).max(100),
  action: z.enum(["activate", "deactivate", "category"]),
  category: z.enum(["saree", "kurti"]).optional(),
}).strict().refine((value) => (value.action === "category") === (value.category !== undefined), {
  message: "Category is required only for category changes",
});
const paymentListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  method: z.enum(["COD", "UPI", "CARD", "NETBANKING", "NET_BANKING", "RAZORPAY"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().min(1).max(120).optional(),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", message: "Invalid payment date range", path: ["to"] });
  }
});
adminRouter.use(requireAdmin);
adminRouter.use("/messages", messagesRouter);
adminRouter.use("/reels", reelsRouter);
adminRouter.use("/reviews", reviewsRouter);

adminRouter.get("/dashboard", emptyQuery, emptyBody, requireRole("superadmin", "manager"), async (_request, response) => {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const salesStart = new Date(todayStart);
  salesStart.setDate(salesStart.getDate() - 29);
  const [today, month, allOrders, newUsers, aov, pendingOrders, lowStock, topProducts, dailySales, categoryRevenue] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } } } },
    ]),
    Order.countDocuments().exec(),
    User.countDocuments({ role: "user", createdAt: { $gte: todayStart } }).exec(),
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
    ]),
    Order.countDocuments({ paymentStatus: "pending" }).exec(),
    Product.find({ isActive: true, archived: false, stock: { $lte: 5 } })
      .select("name sku stock sizes")
      .sort({ stock: 1 })
      .limit(20)
      .lean()
      .exec(),
    Order.aggregate([
      { $match: { paymentStatus: "paid", createdAt: { $gte: salesStart } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", name: { $first: "$items.name" }, quantity: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: ["$items.qty", "$items.unitPrice"] } } } },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: "paid", createdAt: { $gte: salesStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      { $lookup: { from: Product.collection.name, localField: "items.product", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $group: { _id: "$product.category", revenue: { $sum: { $multiply: ["$items.qty", "$items.unitPrice"] } }, units: { $sum: "$items.qty" } } },
      { $sort: { revenue: -1 } },
    ]),
  ]);
  const dailySalesMap = new Map(dailySales.map((item) => [item._id, item]));
  const salesDaily30d = Array.from({ length: 30 }, (_value, index) => {
    const date = new Date(salesStart);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const item = dailySalesMap.get(key);
    return { date: key, orders: item?.orders ?? 0, revenue: item?.revenue ?? 0 };
  });
  response.json({
    orders: allOrders,
    today: { revenue: today[0]?.revenue ?? 0, orders: today[0]?.orders ?? 0 },
    month: { revenue: month[0]?.revenue ?? 0, orders: month[0]?.orders ?? 0 },
    newUsersToday: newUsers,
    averageOrderValue: aov[0]?.orders ? aov[0].revenue / aov[0].orders : 0,
    pendingOrders,
    lowStockProducts: lowStock,
    topProducts,
    salesDaily30d,
    revenueByCategory: categoryRevenue,
  });
});

adminRouter.get("/products", emptyBody, requireRole("superadmin", "manager"), async (request, response) => {
  const {
    page, limit, search, category, subCategory, fabric,
    isActive, isFeatured, archived, minPrice, maxPrice, sortBy, sortOrder,
  } = productListQuery.parse(request.query);
  const safeSearch = search && escapeRegex(search);
  const filter = {
    ...(category && { category }),
    ...(subCategory && { subCategory: new RegExp(`^${escapeRegex(subCategory)}$`, "i") }),
    ...(fabric && { fabric: new RegExp(`^${escapeRegex(fabric)}$`, "i") }),
    ...(isActive !== undefined && { isActive: isActive === "true" }),
    ...(isFeatured !== undefined && { isFeatured: isFeatured === "true" }),
    ...(archived !== undefined ? { archived: archived === "true" } : { archived: false }),
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      price: { ...(minPrice !== undefined && { $gte: minPrice }), ...(maxPrice !== undefined && { $lte: maxPrice }) },
    }),
    ...(safeSearch && {
      $or: [
        { name: { $regex: safeSearch, $options: "i" } },
        { slug: { $regex: safeSearch, $options: "i" } },
        { sku: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } },
        { tags: { $regex: safeSearch, $options: "i" } },
      ],
    }),
  };
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 } as Record<string, 1 | -1>;
  const [items, total] = await Promise.all([
    Product.find(filter).select("+costPrice").sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
    Product.countDocuments(filter).exec(),
  ]);
  response.json({ items, page, limit, total });
});
adminRouter.get("/products/:id", emptyBody, emptyQuery, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Product.findById(id).select("+costPrice").lean().exec();
  if (!item) return response.status(404).json({ error: "Product not found" });
  response.json({ item });
});
adminRouter.patch("/products/bulk", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const { ids, action, category } = bulkProductBody.parse(request.body);
  if (new Set(ids).size !== ids.length) return response.status(400).json({ error: "Product IDs must be unique" });
  const update = action === "category"
    ? { category }
    : action === "activate"
      ? { isActive: true, archived: false }
      : { isActive: false };
  const result = await Product.updateMany({ _id: { $in: ids } }, { $set: update }, { runValidators: true }).exec();
  await writeAudit(request, `bulk_${action}`, "Product", `${result.modifiedCount} products`);
  response.json({ matched: result.matchedCount, modified: result.modifiedCount });
});
adminRouter.get("/products/:id/discount", emptyBody, emptyQuery, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const product = await Product.findById(id).select("slug").lean().exec();
  if (!product) return response.status(404).json({ error: "Product not found" });
  const item = await Discount.findOne({
    scope: "product",
    targets: { $in: [id, product.slug] },
    $expr: { $eq: [{ $size: { $ifNull: ["$targets", []] } }, 1] },
  }).sort({ updatedAt: -1 }).lean().exec();
  response.json({ item });
});
adminRouter.patch("/products/:id/discount", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = linkedProductDiscountBody.parse(request.body);
  const product = await Product.findById(id).select("name slug mrp").lean().exec();
  if (!product) return response.status(404).json({ error: "Product not found" });
  if (input.type === "flat" && input.value >= product.mrp) {
    return response.status(400).json({ error: "Flat discount must be below the product MRP" });
  }
  const existing = await Discount.findOne({
    scope: "product",
    targets: { $in: [id, product.slug] },
    $expr: { $eq: [{ $size: { $ifNull: ["$targets", []] } }, 1] },
  }).sort({ updatedAt: -1 }).exec();
  const values = {
    name: `${product.name.slice(0, 135)} discount`,
    scope: "product" as const,
    targets: [id],
    ...input,
    isActive: true,
    isFlashSale: false,
    priority: existing?.priority ?? 0,
    stackable: false,
  };
  const validated = discountInputSchema.parse(values);
  const flatError = await flatDiscountValidationMessage(validated);
  if (flatError) return response.status(400).json({ error: flatError });
  const item = existing
    ? await Discount.findByIdAndUpdate(existing._id, validated, { new: true, runValidators: true }).lean().exec()
    : await Discount.create({ ...validated, createdBy: request.admin!.id });
  if (!item) return response.status(404).json({ error: "Discount not found" });
  await writeAudit(request, existing ? "update" : "create", "Discount", String(item._id));
  response.json({ item: serializeDiscount(item as ManagedDiscount) });
});
adminRouter.post("/products", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const input = productInputSchema.parse(request.body);
  let item;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      item = await Product.create({
        ...input,
        slug: await uniqueProductSlug(input.name),
        price: input.mrp,
        createdBy: request.admin!.id,
      });
      break;
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt === 2) throw error;
    }
  }
  if (!item) throw new Error("Product could not be created");
  await writeAudit(request, "create", "Product", String(item._id));
  response.status(201).json({ item });
});
adminRouter.patch("/products/:id", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = productUpdateSchema.parse(request.body);
  if (Object.keys(input).length === 0) return response.status(400).json({ error: "Invalid request" });
  const product = await Product.findById(id).select("+costPrice").exec();
  if (!product) return response.status(404).json({ error: "Product not found" });
  const previousImages = product.images.map((image) => ({
    key: image.key,
    thumbnailKey: image.thumbnailKey,
  }));
  product.set(input);
  product.slug = await uniqueProductSlug(product.name, id);
  product.price = product.mrp;
  const parsed = productUpdateCandidateSchema.parse({
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category ?? "",
    subCategory: product.subCategory,
    fabric: product.fabric,
    colors: product.colors,
    sizes: product.sizes.map(({ size, stock }) => ({ size, stock })),
    price: product.price,
    mrp: product.mrp,
    costPrice: product.costPrice,
    images: product.images.map((image) => ({
      url: image.url,
      ...(image.key && { key: image.key }),
      ...(image.publicId && { publicId: image.publicId }),
      ...(image.thumbnailUrl && { thumbnailUrl: image.thumbnailUrl }),
      ...(image.thumbnailKey && { thumbnailKey: image.thumbnailKey }),
      alt: image.alt,
      isPrimary: image.isPrimary,
    })),
    tags: product.tags,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    archived: product.archived,
  });
  product.set(parsed);
  try {
    await product.save();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    product.slug = await uniqueProductSlug(product.name, id);
    await product.save();
  }
  const item = await Product.findById(id).select("+costPrice").lean().exec();
  await writeAudit(request, "update", "Product", id);
  const keptKeys = new Set(product.images.map((image) => image.key).filter(Boolean));
  const removedLocalImages = previousImages.filter((image) =>
    image.key && /^[a-f\d-]{36}\.webp$/i.test(image.key) && !keptKeys.has(image.key),
  );
  if (removedLocalImages.length) await deleteImageAssetsWhenUnused(removedLocalImages);
  response.json({ item });
});
adminRouter.delete("/products/:id", emptyBody, emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Product.findByIdAndUpdate(id, { $set: { isActive: false, archived: true } }, { new: true, runValidators: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Product not found" });
  await writeAudit(request, "archive", "Product", id);
  response.json({ item });
});
adminRouter.post("/products/:id/duplicate", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  duplicateProductBody.parse(request.body ?? {});
  const original = await Product.findById(id).select("+costPrice").lean().exec();
  if (!original) return response.status(404).json({ error: "Product not found" });
  const duplicate = await Product.create({
    name: `${original.name.slice(0, 190)} (Copy)`,
    description: original.description,
    category: original.category,
    subCategory: original.subCategory,
    fabric: original.fabric,
    colors: original.colors,
    sizes: original.sizes,
    slug: await uniqueProductSlug(`${original.name} Copy`),
    price: original.mrp,
    mrp: original.mrp,
    stock: original.stock,
    ...(original.costPrice !== undefined && { costPrice: original.costPrice }),
    images: original.images,
    tags: original.tags,
    isActive: false,
    isFeatured: false,
    isNewArrival: false,
    archived: false,
    createdBy: request.admin!.id,
  });
  await writeAudit(request, "duplicate", "Product", String(duplicate._id));
  response.status(201).json({ item: duplicate });
});
adminRouter.patch("/products/:id/stock", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { size, stock } = stockUpdateBody.parse(request.body);
  const product = await Product.findById(id).exec();
  if (!product) return response.status(404).json({ error: "Product not found" });
  const variant = product.sizes.find((item) => item.size.toLowerCase() === size.toLowerCase());
  if (!variant) return response.status(404).json({ error: "Product size not found" });
  variant.stock = stock;
  await product.save();
  await writeAudit(request, "update_stock", "Product", id);
  response.json({ item: product });
});

adminRouter.get("/orders", emptyBody, requireRole("superadmin", "manager", "support"), async (request, response) => {
  const {
    page, limit, status, paymentStatus, paymentMethod, from, to, customerId,
    search, minAmount, maxAmount, sortBy, sortOrder,
  } = orderListQuery.parse(request.query);
  const safeSearch = search && escapeRegex(search);
  const matchedCustomers = safeSearch
    ? await User.find({
        role: "user",
        $or: [
          { name: { $regex: safeSearch, $options: "i" } },
          { email: { $regex: safeSearch, $options: "i" } },
          { phone: { $regex: safeSearch, $options: "i" } },
        ],
      }).select("_id").lean().exec()
    : [];
  const searchFilters = safeSearch
    ? [
        ...(idSchema.safeParse(search).success ? [{ _id: search }] : []),
        ...(matchedCustomers.length ? [{ user: { $in: matchedCustomers.map((customer) => customer._id) } }] : []),
      ]
    : undefined;
  const filter = {
    ...(status && { orderStatus: status }),
    ...(paymentStatus && { paymentStatus }),
    ...(paymentMethod && { paymentMethod }),
    ...(customerId && { user: customerId }),
    ...((from || to) && { createdAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } }),
    ...((minAmount !== undefined || maxAmount !== undefined) && {
      total: { ...(minAmount !== undefined && { $gte: minAmount }), ...(maxAmount !== undefined && { $lte: maxAmount }) },
    }),
    ...(searchFilters && { $or: searchFilters }),
  };
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 } as Record<string, 1 | -1>;
  const [items, total] = await Promise.all([
    Order.find(filter).select("+adminNotes").sort(sort).skip((page - 1) * limit).limit(limit).populate("user", "name email phone").populate("adminNotes.addedBy", "email role").lean().exec(),
    Order.countDocuments(filter).exec(),
  ]);
  response.json({ items, page, limit, total });
});
adminRouter.get("/orders/:id", emptyBody, emptyQuery, requireRole("superadmin", "manager", "support"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Order.findById(id).select("+adminNotes").populate("user", "name email phone").populate("statusHistory.changedBy", "email role").populate("adminNotes.addedBy", "email role").lean().exec();
  if (!item) return response.status(404).json({ error: "Order not found" });
  response.json({ item });
});
adminRouter.patch("/orders/:id/status", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { status, note, courier, trackingNumber } = statusBody.parse(request.body);
  const order = await Order.findById(id).exec();
  if (!order) return response.status(404).json({ error: "Order not found" });
  if (!canTransitionOrderStatus(order.orderStatus, status)) {
    return response.status(409).json({ error: "Invalid order status transition" });
  }
  const item = await Order.findOneAndUpdate(
    { _id: id, orderStatus: order.orderStatus },
    {
      $set: {
        orderStatus: status,
        ...(status === "delivered" && order.paymentMethod === "COD" && order.paymentStatus === "pending" && { paymentStatus: "paid" }),
        ...(courier !== undefined && { courier }),
        ...(trackingNumber !== undefined && { trackingNumber }),
      },
      $push: {
        statusHistory: {
          status,
          changedBy: request.admin!.id,
          at: new Date(),
          ...(note && { note }),
        },
      },
    },
    { new: true, runValidators: true },
  ).lean().exec();
  if (!item) return response.status(409).json({ error: "Order status changed; reload and retry" });
  await writeAudit(request, "update_status", "Order", id);
  response.json({ item });
});
adminRouter.post("/orders/:id/cancel", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { note } = orderActionNote.parse(request.body);
  const session = await mongoose.startSession();
  let item: unknown;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session).exec();
      if (!order) throw Object.assign(new Error("ORDER_NOT_FOUND"), { status: 404 });
      if (!canCancelOrder(order.orderStatus)) throw Object.assign(new Error("ORDER_NOT_CANCELLABLE"), { status: 409 });
      order.orderStatus = "cancelled";
      order.statusHistory.push({
        status: "cancelled",
        changedBy: new mongoose.Types.ObjectId(request.admin!.id),
        at: new Date(),
        note,
      });
      const quantities = new Map<string, Map<string, number>>();
      for (const line of order.items) {
        const productId = String(line.product);
        const sizeQuantities = quantities.get(productId) ?? new Map<string, number>();
        sizeQuantities.set(line.size, (sizeQuantities.get(line.size) ?? 0) + line.qty);
        quantities.set(productId, sizeQuantities);
      }
      if (quantities.size > 0) {
        const products = await Product.find({ _id: { $in: [...quantities.keys()] } }).session(session).exec();
        if (products.length !== quantities.size) {
          throw Object.assign(new Error("ORDER_PRODUCT_MISSING"), { status: 409 });
        }
        for (const product of products) {
          const expectedSizes = quantities.get(String(product._id))!;
          for (const [size, qty] of expectedSizes) {
            if (product.sizes.length === 0 && size === "One Size") {
              product.stock += qty;
              continue;
            }
            const variant = product.sizes.find((item) => item.size === size);
            if (!variant) throw Object.assign(new Error("ORDER_SIZE_MISSING"), { status: 409 });
            variant.stock += qty;
          }
          await product.save({ session });
        }
      }
      await order.save({ session });
      item = order.toObject();
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") return response.status(404).json({ error: "Order not found" });
    if (error instanceof Error && error.message === "ORDER_NOT_CANCELLABLE") return response.status(409).json({ error: "Only unshipped orders can be cancelled" });
    if (error instanceof Error && ["ORDER_PRODUCT_MISSING", "ORDER_SIZE_MISSING"].includes(error.message)) {
      return response.status(409).json({ error: "Order inventory no longer matches product variants" });
    }
    throw error;
  } finally {
    await session.endSession();
  }
  await writeAudit(request, "cancel", "Order", id);
  response.json({ item });
});
adminRouter.patch("/orders/:id/tracking", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = trackingBody.parse(request.body);
  const item = await Order.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Order not found" });
  await writeAudit(request, "update_tracking", "Order", id);
  response.json({ item });
});
adminRouter.post("/orders/:id/notes", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { note } = orderActionNote.parse(request.body);
  const item = await Order.findByIdAndUpdate(
    id,
    { $push: { adminNotes: { note, addedBy: request.admin!.id, at: new Date() } } },
    { new: true, runValidators: true },
  ).lean().exec();
  if (!item) return response.status(404).json({ error: "Order not found" });
  await writeAudit(request, "add_note", "Order", id);
  response.json({ item });
});
adminRouter.post("/orders/:id/mark-paid", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { note } = orderActionNote.parse(request.body);
  const order = await Order.findOneAndUpdate(
    { _id: id, paymentMethod: "COD", paymentStatus: "pending", orderStatus: { $ne: "cancelled" } },
    {
      $set: { paymentStatus: "paid" },
      $push: { adminNotes: { note, addedBy: request.admin!.id, at: new Date() } },
    },
    { new: true, runValidators: true },
  ).lean().exec();
  if (!order) {
    const existing = await Order.findById(id).select("_id").lean().exec();
    if (!existing) return response.status(404).json({ error: "Order not found" });
    return response.status(409).json({ error: "Only pending COD orders can be marked paid" });
  }
  await writeAudit(request, "mark_paid", "Order", id);
  response.json({ item: order });
});

adminRouter.get("/customers", emptyBody, requireRole("superadmin", "manager", "support"), async (request, response) => {
  const { page, limit, search, isBlocked, sortBy, sortOrder } = customerListQuery.parse(request.query);
  const safeSearch = search && escapeRegex(search);
  const filter = {
    role: "user" as const,
    ...(isBlocked !== undefined && { isBlocked: isBlocked === "true" }),
    ...(safeSearch && {
      $or: [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { phone: { $regex: safeSearch, $options: "i" } },
      ],
    }),
  };
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 } as Record<string, 1 | -1>;
  const [result] = await User.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: Order.collection.name,
        let: { customerId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$user", "$$customerId"] } } },
          { $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            lifetimeValue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } },
          } },
        ],
        as: "orderMetrics",
      },
    },
    { $unwind: { path: "$orderMetrics", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        totalOrders: { $ifNull: ["$orderMetrics.totalOrders", 0] },
        lifetimeValue: { $ifNull: ["$orderMetrics.lifetimeValue", 0] },
      },
    },
    { $project: { name: 1, email: 1, phone: 1, isVerified: 1, isBlocked: 1, createdAt: 1, totalOrders: 1, lifetimeValue: 1 } },
    { $facet: {
      items: [{ $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }],
      count: [{ $count: "total" }],
    } },
  ]);
  const items = result?.items ?? [];
  const total = result?.count[0]?.total ?? 0;
  response.json({ items, page, limit, total });
});
adminRouter.get("/customers/:id", emptyBody, emptyQuery, requireRole("superadmin", "manager", "support"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const [item, orderStats, addresses, wishlist] = await Promise.all([
    User.findOne({ _id: id, role: "user" }).select("name email phone isVerified isBlocked createdAt updatedAt").lean().exec(),
    Order.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(id) } },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        lifetimeValue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } },
      } },
    ]),
    Address.find({ user: id }).lean().exec(),
    Wishlist.findOne({ user: id }).populate("products").lean().exec(),
  ]);
  if (!item) return response.status(404).json({ error: "Customer not found" });
  response.json({
    item,
    totalOrders: orderStats[0]?.totalOrders ?? 0,
    lifetimeValue: orderStats[0]?.lifetimeValue ?? 0,
    addresses,
    wishlist,
  });
});
adminRouter.patch("/customers/:id/block", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { isBlocked } = blockBody.parse(request.body);
  const item = await User.findOneAndUpdate(
    { _id: id, role: "user" },
    {
      $set: { isBlocked },
      ...(isBlocked && { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } }),
    },
    { new: true, runValidators: true },
  ).select("name email phone isBlocked").lean().exec();
  if (!item) return response.status(404).json({ error: "Customer not found" });
  await writeAudit(request, isBlocked ? "block" : "unblock", "Customer", id);
  response.json({ item });
});

adminRouter.get("/payments", emptyBody, requireRole("superadmin", "manager"), async (request, response) => {
  const { page, limit, status, method, from, to, search } = paymentListQuery.parse(request.query);
  const safeSearch = search && escapeRegex(search);
  const matchedCustomers = safeSearch
    ? await User.find({
        role: "user",
        $or: [
          { name: { $regex: safeSearch, $options: "i" } },
          { email: { $regex: safeSearch, $options: "i" } },
        ],
      }).select("_id").lean().exec()
    : [];
  const filter: Record<string, unknown> = {
    ...(status && { paymentStatus: status }),
    ...(method && { paymentMethod: method }),
    ...((from || to) && { createdAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } }),
    ...(safeSearch && { $or: [
      ...(idSchema.safeParse(search).success ? [{ _id: search }] : []),
      ...(matchedCustomers.length ? [{ user: { $in: matchedCustomers.map(({ _id }) => _id) } }] : []),
    ] }),
  };
  const [items, total, totalsByMethod, pendingCod] = await Promise.all([
    Order.find(filter).select("user total paymentMethod paymentStatus orderStatus razorpayOrderId razorpayPaymentId refundStatus refundAmount refundedAt createdAt updatedAt").populate("user", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Order.countDocuments(filter).exec(),
    Order.aggregate([{ $match: filter }, {
      $group: {
        _id: "$paymentMethod",
        orderCount: { $sum: 1 },
        totalAmount: { $sum: "$total" },
        paidAmount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } },
        pendingAmount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, "$total", 0] } },
      },
    }]),
    Order.aggregate([
      { $match: { ...filter, paymentMethod: "COD", paymentStatus: "pending" } },
      { $group: { _id: null, amount: { $sum: "$total" }, orderCount: { $sum: 1 } } },
    ]),
  ]);
  response.json({
    items,
    page,
    limit,
    total,
    totalsByMethod: totalsByMethod.map(({ _id, ...totals }) => ({ method: _id, ...totals })),
    pendingCodAmount: pendingCod[0]?.amount ?? 0,
    pendingCodOrders: pendingCod[0]?.orderCount ?? 0,
  });
});
adminRouter.post("/payments/:id/refund", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { amount, note } = refundBody.parse(request.body);
  const existing = await Order.findById(id).select("total paymentStatus refundStatus").lean().exec();
  if (!existing) return response.status(404).json({ error: "Payment not found" });
  if (existing.paymentStatus !== "paid" || ["refunded", "pending"].includes(existing.refundStatus ?? "none")) {
    return response.status(409).json({ error: "Payment is not eligible for a manual refund" });
  }
  const refundAmount = amount;
  if (refundAmount > existing.total) return response.status(400).json({ error: "Refund amount exceeds the order total" });
  const item = await Order.findOneAndUpdate(
    { _id: id, paymentStatus: "paid", refundStatus: { $nin: ["refunded", "pending"] } },
    {
      $set: {
        paymentStatus: "refunded",
        refundStatus: "refunded",
        refundAmount,
        refundedAt: new Date(),
        refundedBy: request.admin!.id,
        refundReason: note,
      },
    },
    { new: true, runValidators: true },
  ).lean().exec();
  if (!item) return response.status(409).json({ error: "Payment changed; reload and retry" });
  await writeAudit(request, "manual_refund", "Payment", id);
  response.json({ item });
});

adminRouter.get("/coupons/:id", emptyBody, emptyQuery, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Coupon.findById(id).lean().exec();
  if (!item) return response.status(404).json({ error: "Coupon not found" });
  response.json({ item: serializeCoupon(item) });
});
adminRouter.get("/coupons", emptyBody, requireRole("superadmin", "manager"), async (request, response) => {
  const { page, limit } = pageSchema.parse(request.query);
  const [items, total] = await Promise.all([
    Coupon.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Coupon.countDocuments().exec(),
  ]);
  response.json({ items: items.map((item) => serializeCoupon(item)), page, limit, total });
});
adminRouter.post("/coupons", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const input = couponInputSchema.parse(request.body);
  let item;
  try {
    item = await Coupon.create(input);
  } catch (error) {
    if (isDuplicateKeyError(error)) return response.status(409).json({ error: "Coupon code already exists" });
    throw error;
  }
  await writeAudit(request, "create", "Coupon", String(item._id));
  response.status(201).json({ item: serializeCoupon(item.toObject()) });
});
adminRouter.patch("/coupons/:id", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = couponUpdateSchema.parse(request.body);
  if (Object.keys(input).length === 0) return response.status(400).json({ error: "Invalid request" });
  const existing = await Coupon.findById(id).lean().exec();
  if (!existing) return response.status(404).json({ error: "Coupon not found" });
  couponInputSchema.parse({
    code: input.code ?? existing.code,
    type: input.type ?? existing.type,
    value: input.value ?? existing.value,
    minOrder: input.minOrder ?? existing.minOrder,
    maxDiscount: input.maxDiscount ?? existing.maxDiscount,
    expiresAt: new Date(input.expiresAt ?? existing.expiresAt).toISOString(),
    usageLimit: input.usageLimit ?? existing.usageLimit,
    perUserLimit: input.perUserLimit ?? existing.perUserLimit,
    isActive: input.isActive ?? existing.isActive,
  });
  let item;
  try {
    item = await Coupon.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean().exec();
  } catch (error) {
    if (isDuplicateKeyError(error)) return response.status(409).json({ error: "Coupon code already exists" });
    throw error;
  }
  if (!item) return response.status(404).json({ error: "Coupon not found" });
  await writeAudit(request, "update", "Coupon", id);
  response.json({ item: serializeCoupon(item) });
});
adminRouter.delete("/coupons/:id", emptyBody, emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Coupon.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Coupon not found" });
  await writeAudit(request, "deactivate", "Coupon", id);
  response.json({ item: serializeCoupon(item) });
});
adminRouter.post("/coupons/:id/activate", emptyBody, emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const existing = await Coupon.findById(id).select("expiresAt").lean().exec();
  if (!existing) return response.status(404).json({ error: "Coupon not found" });
  if (new Date(existing.expiresAt).getTime() <= Date.now()) return response.status(409).json({ error: "Expired coupons cannot be activated" });
  const item = await Coupon.findByIdAndUpdate(id, { isActive: true }, { new: true, runValidators: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Coupon not found" });
  await writeAudit(request, "activate", "Coupon", id);
  response.json({ item: serializeCoupon(item) });
});
adminRouter.post("/coupons/:id/deactivate", emptyBody, emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Coupon.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Coupon not found" });
  await writeAudit(request, "deactivate", "Coupon", id);
  response.json({ item: serializeCoupon(item) });
});
adminRouter.post("/coupons/generate", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const { count, prefix, ...input } = couponGenerationSchema.parse(request.body);
  let items: Awaited<ReturnType<typeof Coupon.insertMany>> = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const codes = generateUniqueCouponCodes(count, prefix);
    const existingCodes = await Coupon.distinct("code", { code: { $in: codes } }).exec();
    if (existingCodes.length > 0) continue;
    const batch = codes.map((code) => ({ _id: new mongoose.Types.ObjectId(), ...input, code }));
    try {
      items = await Coupon.insertMany(batch, { ordered: true });
      break;
    } catch (error) {
      await Coupon.deleteMany({ _id: { $in: batch.map((item) => item._id) } }).exec();
      if (!isDuplicateKeyError(error)) throw error;
      if (attempt === 2) return response.status(409).json({ error: "Unable to reserve unique coupon codes; retry the request" });
    }
  }
  if (items.length !== count) return response.status(409).json({ error: "Unable to reserve unique coupon codes; retry the request" });
  await writeAudit(request, "bulk_generate", "Coupon", `${items.length} codes`);
  response.status(201).json({ items: items.map((item) => serializeCoupon(item.toObject())), count: items.length });
});
adminRouter.post("/coupons/:id/duplicate", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const options = couponDuplicateSchema.parse(request.body);
  const existing = await Coupon.findById(id).lean().exec();
  if (!existing) return response.status(404).json({ error: "Coupon not found" });
  const code = options.code ?? `${existing.code.slice(0, 27)}-${generateUniqueCouponCodes(1)[0]}`;
  try {
    const item = await Coupon.create({
      code,
      type: existing.type,
      value: existing.value,
      minOrder: existing.minOrder,
      maxDiscount: existing.maxDiscount,
      expiresAt: existing.expiresAt,
      usageLimit: existing.usageLimit,
      perUserLimit: existing.perUserLimit,
      isActive: true,
    });
    await writeAudit(request, "duplicate", "Coupon", String(item._id));
    response.status(201).json({ item: serializeCoupon(item.toObject()) });
  } catch (error) {
    if (isDuplicateKeyError(error)) return response.status(409).json({ error: "Coupon code already exists" });
    throw error;
  }
});
adminRouter.get("/coupons/:id/usage", emptyBody, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const query = couponUsageQuerySchema.parse(request.query);
  const coupon = await Coupon.findById(id).select("code").lean().exec();
  if (!coupon) return response.status(404).json({ error: "Coupon not found" });
  const createdAt: Record<string, Date> = {};
  if (query.from) createdAt.$gte = query.from;
  if (query.to) createdAt.$lte = query.to;
  const filter = { coupon: id, ...(Object.keys(createdAt).length > 0 && { createdAt }) };
  const [items, total, usage] = await Promise.all([
    CouponRedemption.find(filter).populate("user", "name email").sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    CouponRedemption.countDocuments(filter).exec(),
    CouponRedemption.aggregate([
      { $match: { coupon: new mongoose.Types.ObjectId(id), ...(Object.keys(createdAt).length > 0 && { createdAt }) } },
      { $group: { _id: null, totalUses: { $sum: "$usedCount" }, uniqueUsers: { $sum: 1 } } },
    ]).exec(),
  ]);
  response.json({
    couponId: id,
    code: coupon.code,
    totalRedemptions: total,
    totalUses: usage[0]?.totalUses ?? 0,
    uniqueUsers: usage[0]?.uniqueUsers ?? 0,
    items,
    page: query.page,
    limit: query.limit,
    from: query.from?.toISOString() ?? null,
    to: query.to?.toISOString() ?? null,
  });
});

adminRouter.get("/discounts/:id", emptyBody, emptyQuery, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Discount.findById(id).populate("createdBy", "email role").lean().exec();
  if (!item) return response.status(404).json({ error: "Discount not found" });
  response.json({ item: serializeDiscount(item as unknown as ManagedDiscount) });
});
adminRouter.get("/discounts", emptyBody, requireRole("superadmin", "manager"), async (request, response) => {
  const { page, limit } = pageSchema.parse(request.query);
  const [items, total] = await Promise.all([
    Discount.find().populate("createdBy", "email role").sort({ startsAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Discount.countDocuments().exec(),
  ]);
  response.json({ items: items.map((item) => serializeDiscount(item as unknown as ManagedDiscount)), page, limit, total });
});
adminRouter.post("/discounts", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const input = discountUtcInputSchema.parse(request.body);
  const validationMessage = await flatDiscountValidationMessage(input);
  if (validationMessage) return response.status(400).json({ error: validationMessage });
  const item = await Discount.create({ ...input, createdBy: request.admin!.id });
  await writeAudit(request, "create", "Discount", String(item._id));
  response.status(201).json({ item: serializeDiscount(item.toObject() as unknown as ManagedDiscount) });
});
adminRouter.patch("/discounts/:id", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = discountUtcUpdateSchema.parse(request.body);
  if (Object.keys(input).length === 0) return response.status(400).json({ error: "Invalid request" });
  const existing = await Discount.findById(id)
    .select("name scope targets type value maxDiscount startsAt endsAt isActive isFlashSale priority stackable")
    .lean()
    .exec();
  if (!existing) return response.status(404).json({ error: "Discount not found" });
  const candidate = {
    name: input.name ?? existing.name,
    scope: input.scope ?? existing.scope,
    targets: input.targets ?? existing.targets,
    type: input.type ?? existing.type,
    value: input.value ?? existing.value,
    maxDiscount: input.maxDiscount ?? existing.maxDiscount,
    startsAt: input.startsAt ?? existing.startsAt,
    endsAt: input.endsAt ?? existing.endsAt,
    isActive: input.isActive ?? existing.isActive,
    isFlashSale: input.isFlashSale ?? existing.isFlashSale,
    priority: input.priority ?? existing.priority,
    stackable: input.stackable ?? existing.stackable,
  };
  discountInputSchema.parse(candidate);
  const validationMessage = await flatDiscountValidationMessage(candidate);
  if (validationMessage) return response.status(400).json({ error: validationMessage });
  const item = await Discount.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Discount not found" });
  await writeAudit(request, "update", "Discount", id);
  response.json({ item: serializeDiscount(item as unknown as ManagedDiscount) });
});
adminRouter.delete("/discounts/:id", emptyBody, emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Discount.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Discount not found" });
  await writeAudit(request, "deactivate", "Discount", id);
  response.json({ item: serializeDiscount(item as unknown as ManagedDiscount) });
});
adminRouter.post("/discounts/:id/activate", emptyBody, emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const existing = await Discount.findById(id).select("endsAt").lean().exec();
  if (!existing) return response.status(404).json({ error: "Discount not found" });
  if (new Date(existing.endsAt).getTime() <= Date.now()) return response.status(409).json({ error: "Expired discounts cannot be activated" });
  const item = await Discount.findByIdAndUpdate(id, { isActive: true }, { new: true, runValidators: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Discount not found" });
  await writeAudit(request, "activate", "Discount", id);
  response.json({ item: serializeDiscount(item as unknown as ManagedDiscount) });
});
adminRouter.post("/discounts/:id/deactivate", emptyBody, emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Discount.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Discount not found" });
  await writeAudit(request, "deactivate", "Discount", id);
  response.json({ item: serializeDiscount(item as unknown as ManagedDiscount) });
});
adminRouter.post("/discounts/:id/duplicate", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { name } = discountDuplicateSchema.parse(request.body);
  const existing = await Discount.findById(id).lean().exec();
  if (!existing) return response.status(404).json({ error: "Discount not found" });
  const input = {
    name: name ?? `${existing.name.slice(0, 143)} (copy)`,
    scope: existing.scope,
    targets: existing.targets,
    type: existing.type,
    value: existing.value,
    maxDiscount: existing.maxDiscount,
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
    isActive: true,
    isFlashSale: existing.isFlashSale ?? false,
    priority: existing.priority,
    stackable: existing.stackable,
  };
  const validationMessage = await flatDiscountValidationMessage(input);
  if (validationMessage) return response.status(400).json({ error: validationMessage });
  const item = await Discount.create({ ...input, createdBy: request.admin!.id });
  await writeAudit(request, "duplicate", "Discount", String(item._id));
  response.status(201).json({ item: serializeDiscount(item.toObject() as unknown as ManagedDiscount) });
});
adminRouter.post("/discounts/preview", emptyQuery, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const { productId, asOf } = discountPreviewBody.parse(request.body);
  const productFilter = mongoose.isValidObjectId(productId) ? { _id: productId } : { slug: productId };
  const product = await Product.findOne(productFilter).select("slug category tags price").lean().exec();
  if (!product) return response.status(404).json({ error: "Product not found" });
  const previewAt = asOf ?? new Date();
  const discounts = await Discount.find().sort({ priority: -1, _id: 1 }).lean().exec();
  response.json({
    product: { id: String(product._id), slug: product.slug, category: product.category ?? "", price: product.price },
    asOf: previewAt.toISOString(),
    ...previewDiscounts(discounts as unknown as ManagedDiscount[], {
      id: String(product._id),
      slug: product.slug,
      category: product.category ?? "",
      tags: product.tags,
      price: product.price,
    }, previewAt),
  });
});

adminRouter.get("/audit-logs", emptyBody, requireRole("superadmin"), async (request, response) => {
  const { page, limit } = pageSchema.parse(request.query);
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    AuditLog.countDocuments().exec(),
  ]);
  response.json({ items, page, limit, total });
});
adminRouter.get("/exports/orders.csv", emptyBody, emptyQuery, requireRole("superadmin", "manager"), async (request, response) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(10_000).lean().exec();
  await writeAudit(request, "export", "Order", `${orders.length} rows`);
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [
    ["id", "createdAt", "customerId", "status", "paymentStatus", "total"],
    ...orders.map((order) => [
      String(order._id), order.createdAt.toISOString(), String(order.user),
      order.orderStatus, order.paymentStatus, order.total,
    ]),
  ];
  response.type("text/csv").attachment("orders.csv").send(rows.map((row) => row.map(cell).join(",")).join("\r\n"));
});

adminRouter.get("/customers/:id/addresses", emptyBody, emptyQuery, requireRole("superadmin", "manager", "support"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const items = await Address.find({ user: id }).lean().exec();
  response.json({ items });
});
adminRouter.get("/customers/:id/wishlist", emptyBody, emptyQuery, requireRole("superadmin", "manager", "support"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Wishlist.findOne({ user: id }).populate("products").lean().exec();
  response.json({ item });
});
