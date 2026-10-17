import { z } from "zod";

export const environmentSchema = z
  .object({
    PORT: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z.preprocess(
        (value) => (value === "" || value === undefined ? "5000" : value),
        z.coerce
          .number({ error: "must be a valid port number" })
          .int("must be a whole number")
          .min(1, "must be between 1 and 65535")
          .max(65_535, "must be between 1 and 65535"),
      ),
    ),
    DATABASE_URL: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().url("must be a valid URL").optional(),
    ),
    MONGODB_URI: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().url("must be a valid URL").optional(),
    ),
    JWT_SECRET: z
      .string({ error: "missing" })
      .trim()
      .min(1, "missing")
      .min(32, "must be at least 32 characters"),
    CLIENT_URL: z
      .string({ error: "missing" })
      .trim()
      .min(1, "missing")
      .transform((value) => value.replace(/\/$/, ""))
      .refine(
        isValidClientUrl,
        "must start with http:// or https:// and have no trailing slash or path",
      ),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DEMO_PAYMENTS: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    COOKIE_SAME_SITE: z.enum(["lax", "none"]).default("lax"),
    TRUST_PROXY: z
      .string()
      .trim()
      .min(1, "must not be empty")
      .default("false")
      .transform((value): boolean | number | string => {
        if (value === "true") return true;
        if (value === "false") return false;
        if (/^\d+$/.test(value)) return Number(value);
        return value;
      }),
  })
  .superRefine((value, context) => {
    if (!value.DATABASE_URL && !value.MONGODB_URI) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "missing (set DATABASE_URL or MONGODB_URI)",
      });
    }
  })
  .transform((value) => ({
    ...value,
    DATABASE_URL: value.DATABASE_URL ?? value.MONGODB_URI!,
  }));

function isValidClientUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === value &&
      !value.endsWith("/")
    );
  } catch {
    return false;
  }
}
