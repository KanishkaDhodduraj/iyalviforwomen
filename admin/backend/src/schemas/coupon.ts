import { z } from "zod";

const utcDateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));

const couponFields = {
  type: z.enum(["percent", "flat"]),
  value: z.number().finite().positive(),
  minOrder: z.number().finite().min(0).default(0),
  maxDiscount: z.number().finite().min(0).optional(),
  expiresAt: utcDateTime,
  usageLimit: z.number().int().min(1),
  perUserLimit: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
};

function validateCoupon(
  coupon: { type?: string; value?: number },
  context: z.RefinementCtx,
) {
  if (coupon.type === "percent" && coupon.value !== undefined && (coupon.value < 1 || coupon.value > 90)) {
    context.addIssue({ code: "custom", message: "Percentage must be between 1 and 90", path: ["value"] });
  }
}

export const couponInputSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_-]+$/i).transform((value) => value.toUpperCase()),
  ...couponFields,
}).strict().superRefine(validateCoupon);

export const couponUpdateSchema = z.object({
  code: couponInputSchema.shape.code.optional(),
  type: couponFields.type.optional(),
  value: couponFields.value.optional(),
  minOrder: couponFields.minOrder.optional(),
  maxDiscount: couponFields.maxDiscount.optional(),
  expiresAt: couponFields.expiresAt.optional(),
  usageLimit: couponFields.usageLimit.optional(),
  perUserLimit: couponFields.perUserLimit.optional(),
  isActive: couponFields.isActive.optional(),
}).strict().superRefine(validateCoupon);

export const couponGenerationSchema = z.object({
  prefix: z.string().trim().max(12).regex(/^[A-Z0-9_-]*$/i).transform((value) => value.toUpperCase()).default(""),
  count: z.number().int().min(1).max(500),
  type: couponFields.type,
  value: couponFields.value,
  minOrder: couponFields.minOrder,
  maxDiscount: couponFields.maxDiscount,
  expiresAt: couponFields.expiresAt,
  usageLimit: couponFields.usageLimit,
  perUserLimit: couponFields.perUserLimit,
  isActive: couponFields.isActive,
}).strict().superRefine(validateCoupon);

export const couponDuplicateSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_-]+$/i).transform((value) => value.toUpperCase()).optional(),
}).strict();

export const couponUsageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  from: utcDateTime.optional(),
  to: utcDateTime.optional(),
}).strict().superRefine((query, context) => {
  if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
    context.addIssue({ code: "custom", message: "Invalid UTC date range", path: ["to"] });
  }
});

export const utcDateTimeSchema = utcDateTime;
