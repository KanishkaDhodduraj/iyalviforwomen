import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
if (process.env.NODE_ENV !== "test") {
  dotenv.config({ path: envPath, quiet: true });
}

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  DATABASE_URL: z.string().trim().min(1),
  ADMIN_JWT_SECRET: z.string().min(32),
  ADMIN_CLIENT_URL: z.string().url().refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin === value.replace(/\/$/, "")
    );
  }).transform((value) => value.replace(/\/$/, "")),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  COOKIE_SAME_SITE: z.enum(["lax", "none"]).default("lax"),
  TRUST_PROXY: z.enum(["0", "1", "true", "false"]).default("0"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => issue.path.join("."));
  console.error(`Invalid admin environment. Check: ${[...new Set(details)].join(", ")}`);
  process.exit(1);
}

export const env = parsed.data;
