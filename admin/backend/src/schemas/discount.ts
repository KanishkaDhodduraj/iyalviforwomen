import { z } from "zod";

const fields = {
  name: z.string().trim().min(1).max(150),
  scope: z.enum(["product", "category", "collection", "sitewide"]),
  targets: z.array(z.string().trim().min(1).max(200)).max(500),
  type: z.enum(["percent", "flat"]),
  value: z.number().finite().positive(),
  maxDiscount: z.number().finite().min(0).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().default(true),
  isFlashSale: z.boolean().default(false),
  priority: z.number().int().min(0).max(1_000_000).default(0),
  stackable: z.boolean().default(false),
};

function addDiscountIssues(
  value: { scope: string; targets: string[]; type: string; value: number; startsAt: Date | string; endsAt: Date | string },
  context: z.RefinementCtx,
) {
  const startsAt = new Date(value.startsAt);
  const endsAt = new Date(value.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    context.addIssue({ code: "custom", message: "Invalid discount window", path: ["endsAt"] });
  }
  if (value.type === "percent" && (value.value < 1 || value.value > 90)) {
    context.addIssue({ code: "custom", message: "Percentage must be between 1 and 90", path: ["value"] });
  }
  if (value.scope === "sitewide" && value.targets.length > 0) {
    context.addIssue({ code: "custom", message: "Sitewide discounts cannot have targets", path: ["targets"] });
  } else if (value.scope !== "sitewide" && value.targets.length === 0) {
    context.addIssue({ code: "custom", message: "This discount scope requires at least one target", path: ["targets"] });
  }
}

export const discountInputSchema = z.object(fields).strict().superRefine(addDiscountIssues);
export const discountUpdateSchema = z.object(fields).partial().strict();

const utcDateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const discountUtcInputSchema = z.object({
  ...fields,
  startsAt: utcDateTime,
  endsAt: utcDateTime,
}).strict().superRefine(addDiscountIssues);

export const discountUtcUpdateSchema = z.object({
  ...fields,
  startsAt: utcDateTime,
  endsAt: utcDateTime,
}).partial().strict();

export const discountDuplicateSchema = z.object({
  name: fields.name.optional(),
}).strict();
