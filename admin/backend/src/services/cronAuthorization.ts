import { createHash, timingSafeEqual } from "node:crypto";

export function hasValidCronAuthorization(
  authorization: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length);
  if (!token) return false;
  const expectedDigest = createHash("sha256").update(secret).digest();
  const actualDigest = createHash("sha256").update(token).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}
