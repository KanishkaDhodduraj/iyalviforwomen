import { randomBytes } from "node:crypto";

export function generateUniqueCouponCodes(count: number, prefix = ""): string[] {
  const normalizedPrefix = prefix.trim().toUpperCase();
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(`${normalizedPrefix}${randomBytes(6).toString("hex").toUpperCase()}`);
  }
  return [...codes];
}
