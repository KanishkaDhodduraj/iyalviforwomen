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

const productShape = {
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/),
  sku: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  category: z.enum(["saree", "kurti"]),
  subCategory: z.string().trim().min(1).max(100),
  fabric: z.string().trim().min(1).max(100),
  occasion: z.string().trim().min(1).max(100),
  colors: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
  sizes: z.array(z.object({
    size: z.string().trim().min(1).max(40),
    stock: z.number().int().min(0).max(1_000_000).default(0),
  }).strict()).min(1).max(30),
  price: z.number().finite().min(0),
  mrp: z.number().finite().min(0),
  costPrice: z.number().finite().min(0).optional(),
  images: z.array(productImageInputSchema).max(8).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  archived: z.boolean().default(false),
};

function checkProduct(
  value: {
    sizes: Array<{ size: string }>;
    images: Array<{ isPrimary: boolean; key?: string }>;
    price: number;
    mrp: number;
  },
  context: z.RefinementCtx,
) {
  if (new Set(value.sizes.map(({ size }) => size.toLowerCase())).size !== value.sizes.length) {
    context.addIssue({ code: "custom", message: "Product sizes must be unique", path: ["sizes"] });
  }
  if (value.images.filter(({ isPrimary }) => isPrimary).length > 1) {
    context.addIssue({ code: "custom", message: "Only one gallery image may be primary", path: ["images"] });
  }
  if (value.images.length > 0 && value.images.filter(({ isPrimary }) => isPrimary).length !== 1) {
    context.addIssue({ code: "custom", message: "Exactly one gallery image must be primary", path: ["images"] });
  }
  const imageKeys = value.images.flatMap((image) => image.key ? [image.key] : []);
  if (new Set(imageKeys).size !== imageKeys.length) {
    context.addIssue({ code: "custom", message: "Image keys must be unique", path: ["images"] });
  }
  if (value.mrp < value.price) {
    context.addIssue({ code: "custom", message: "MRP cannot be lower than price", path: ["mrp"] });
  }
}

export const productInputSchema = z.object(productShape).strict().superRefine(checkProduct);
export const productUpdateSchema = z.object(productShape).partial().strict();

export const productUpdateCandidateSchema = productInputSchema;
