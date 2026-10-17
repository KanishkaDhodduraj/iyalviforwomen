import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { User } from "../models/User.js";

const accessCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.COOKIE_SAME_SITE,
  path: "/",
};

const refreshCookieOptions = { ...accessCookieOptions, path: "/api/auth" };

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function authUserId(request: Request): string {
  const auth = (request as AuthenticatedRequest).auth;
  if (!auth) throw new Error("Authenticated route missing auth context");
  return auth.id;
}

export async function issueSession(
  user: { _id: unknown; role: "user" | "admin"; isBlocked?: boolean },
  response: Response,
): Promise<void> {
  if (user.isBlocked) throw new HttpError(401, "Account unavailable");
  const id = String(user._id);
  const accessToken = jwt.sign({ sub: id, role: user.role, type: "access" }, env.JWT_SECRET, {
    expiresIn: "15m",
    issuer: "iyalvi-api",
    audience: "iyalvi-client",
  });
  const refreshToken = jwt.sign(
    { sub: id, type: "refresh", nonce: randomBytes(16).toString("hex") },
    env.JWT_SECRET,
    { expiresIn: "7d", issuer: "iyalvi-api", audience: "iyalvi-client" },
  );
  const updated = await User.updateOne(
    { _id: user._id, isBlocked: { $ne: true } },
    {
      $set: {
        refreshTokenHash: digest(refreshToken),
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    },
  );
  if (updated.modifiedCount !== 1) throw new HttpError(401, "Account unavailable");
  response.cookie("accessToken", accessToken, { ...accessCookieOptions, maxAge: 15 * 60 * 1000 });
  response.cookie("refreshToken", refreshToken, {
    ...refreshCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function rotateSession(refreshToken: string, response: Response): Promise<boolean> {
  let claims: jwt.JwtPayload;
  try {
    const verified = jwt.verify(refreshToken, env.JWT_SECRET, {
      issuer: "iyalvi-api",
      audience: "iyalvi-client",
    });
    if (typeof verified === "string" || verified.type !== "refresh" || typeof verified.sub !== "string") {
      return false;
    }
    claims = verified;
  } catch {
    return false;
  }

  const user = await User.findOne({ _id: claims.sub })
    .select("+refreshTokenHash +refreshTokenExpiresAt")
    .exec();
  const storedHash = user?.refreshTokenHash;
  const presentedHash = digest(refreshToken);
  if (user?.isBlocked) throw new HttpError(401, "Account unavailable");
  if (
    !user ||
    !storedHash ||
    !user.refreshTokenExpiresAt ||
    user.refreshTokenExpiresAt <= new Date() ||
    storedHash.length !== presentedHash.length ||
    !timingSafeEqual(Buffer.from(storedHash), Buffer.from(presentedHash))
  ) {
    return false;
  }

  const result = await User.updateOne(
    { _id: user._id, refreshTokenHash: storedHash },
    { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } },
  );
  if (result.modifiedCount !== 1) return false;
  await issueSession(user, response);
  return true;
}

export async function revokeSession(refreshToken: unknown): Promise<void> {
  if (typeof refreshToken !== "string") return;
  await User.updateOne(
    { refreshTokenHash: digest(refreshToken) },
    { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } },
  );
}

export function clearSessionCookies(response: Response): void {
  response.clearCookie("accessToken", accessCookieOptions);
  response.clearCookie("refreshToken", refreshCookieOptions);
}

export function sessionUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
  };
}
