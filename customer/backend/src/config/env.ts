import "./loadEnv.js";

import { environmentSchema } from "./envSchema.js";

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  const reasons = new Map<string, string>();
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "UNKNOWN");
    if (!reasons.has(key)) reasons.set(key, issue.message);
  }
  const details = [...reasons].map(([key, reason]) => `${key}: ${reason}`);
  console.error(`Invalid backend environment. Check: ${details.join("; ")}`);
  process.exit(1);
}

export const env = parsed.data;
