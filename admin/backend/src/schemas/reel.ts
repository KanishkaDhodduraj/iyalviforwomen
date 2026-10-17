import { z } from "zod";

export const idSchema = z.string().regex(/^[a-f\d]{24}$/i);

export function parseInstagramLink(value: string): { shortcode: string; instagramUrl: string } | null {
  try {
    const url = new URL(value);
    const match = /^\/(reel|p)\/([A-Za-z0-9_-]{1,20})\/?$/i.exec(url.pathname);
    if (
      url.protocol === "https:" &&
      (url.hostname === "instagram.com" || url.hostname === "www.instagram.com") &&
      !url.port &&
      !url.username &&
      !url.password &&
      match
    ) {
      return {
        shortcode: match[2]!,
        instagramUrl: `https://www.instagram.com/${match[1]!.toLowerCase()}/${match[2]}/`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function extractInstagramShortcode(value: string): string | null {
  return parseInstagramLink(value)?.shortcode ?? null;
}

const instagramLinkSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .superRefine((value, context) => {
    if (!parseInstagramLink(value)) {
      context.addIssue({ code: "custom", message: "Instagram URL must link to a reel or post" });
    }
  })
  .transform((value) => parseInstagramLink(value)!);

export const instagramReelUrlSchema = instagramLinkSchema;

const titleSchema = z.string().trim().min(1).max(120);
const orderSchema = z.number().int().min(0).max(1_000_000);

export const reelCreateSchema = z.object({
  title: titleSchema,
  instagramUrl: instagramLinkSchema,
  order: orderSchema.default(0),
  isActive: z.boolean().default(true),
}).strict();

export const reelUpdateSchema = z.object({
  title: titleSchema.optional(),
  instagramUrl: instagramLinkSchema.optional(),
  order: orderSchema.optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const reelListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  isActive: z.enum(["true", "false"]).optional(),
}).strict();

export const reelReorderSchema = z.object({
  ids: z.array(idSchema).min(1).max(500),
}).strict().refine(({ ids }) => new Set(ids).size === ids.length, "Reel IDs must be unique");
