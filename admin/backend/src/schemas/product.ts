import { z } from "zod";

export const productImageInputSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  key: z.string().regex(/^[a-f\d-]{36}\.webp$/i).optional(),
  publicId: z.string().trim().max(100).optional(),
  thumbnailUrl: z.string().trim().max(2048).optional(),
  thumbnailKey: z.string().regex(/^[a-f\d-]{36}-thumb\.webp$/i).optional(),
  alt: z.string().trim().max(200).default(""),
  isPrimary: z.boolean().default(false),
}).strict().refine((image) => Boolean(image.key || image.publicId), {
  message: "An image key or public ID is required",
  path: ["key"],
});

const editableFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  category: z.enum(["saree", "kurti"]).optional(),
  subCategory: z.string().trim().max(100).optional(),
  fabric: z.string().trim().max(100).optional(),
  colors: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  sizes: z.array(z.object({
    size: z.string().trim().min(1).max(40),
    stock: z.number().int().min(0).max(1_000_000).default(0),
  }).strict()).max(30).default([]),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  mrp: z.number().finite().positive(),
  costPrice: z.number().finite().min(0).optional(),
  images: z.array(productImageInputSchema).max(8).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  archived: z.boolean().default(false),
};

function checkProduct(
  value: { sizes: Array<{ size: string; stock: number }>; images: Array<{ isPrimary: boolean; key?: string }>; stock?: number },
  context: z.RefinementCtx,
) {
  if (new Set(value.sizes.map(({ size }) => size.toLowerCase())).size !== value.sizes.length) {
    context.addIssue({ code: "custom", message: "Product sizes must be unique", path: ["sizes"] });
  }
  if (value.images.filter(({ isPrimary }) => isPrimary).length > 1 ||
      (value.images.length > 0 && value.images.filter(({ isPrimary }) => isPrimary).length !== 1)) {
    context.addIssue({ code: "custom", message: "Exactly one gallery image must be primary", path: ["images"] });
  }
  const imageKeys = value.images.flatMap((image) => image.key ? [image.key] : []);
  if (new Set(imageKeys).size !== imageKeys.length) {
    context.addIssue({ code: "custom", message: "Image keys must be unique", path: ["images"] });
  }
  if (value.sizes.length && value.stock !== undefined) {
    context.addIssue({ code: "custom", message: "Use size stock or total stock, not both", path: ["stock"] });
  }
}

export const productInputSchema = z.object({
  ...editableFields,
  name: editableFields.name,
  mrp: editableFields.mrp,
}).strict().superRefine(checkProduct);

export const productUpdateSchema = z.object(editableFields).partial().strict().superRefine((value, context) => {
  if (value.sizes?.length && value.stock !== undefined) {
    context.addIssue({ code: "custom", message: "Use size stock or total stock, not both", path: ["stock"] });
  }
});

export const productUpdateCandidateSchema = z.object({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/),
  sku: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()).optional(),
  name: editableFields.name,
  description: editableFields.description,
  category: editableFields.category,
  subCategory: editableFields.subCategory,
  fabric: editableFields.fabric,
  colors: editableFields.colors,
  sizes: editableFields.sizes,
  stock: z.number().int().min(0).max(1_000_000),
  price: z.number().finite().min(0),
  mrp: editableFields.mrp,
  costPrice: editableFields.costPrice,
  images: editableFields.images,
  tags: editableFields.tags,
  isActive: editableFields.isActive,
  isFeatured: editableFields.isFeatured,
  isNewArrival: editableFields.isNewArrival,
  archived: editableFields.archived,
}).strict().superRefine((value, context) => {
  checkProduct(value, context);
  if (value.price !== value.mrp) {
    context.addIssue({ code: "custom", message: "Selling price must match MRP before discounts", path: ["price"] });
  }
});
