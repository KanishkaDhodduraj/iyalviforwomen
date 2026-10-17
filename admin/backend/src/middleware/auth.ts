import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AdminUser } from "../models/AdminUser.js";

export type AdminRole = "superadmin" | "manager" | "support";
declare module "express-serve-static-core" {
  interface Request {
    admin?: { id: string; email: string; role: AdminRole };
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.COOKIE_SAME_SITE,
  path: "/",
};

export const requireCsrf: RequestHandler = (request, response, next) => {
  const cookie = request.cookies?.admin_csrf;
  const header = request.get("x-csrf-token");
  if (
    typeof cookie !== "string" ||
    typeof header !== "string" ||
    cookie.length !== header.length ||
    !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))
  ) {
    response.status(403).json({ error: "Request verification failed" });
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = async (request, response, next) => {
  try {
    const token = request.cookies?.admin_access;
    const refreshToken = request.cookies?.admin_refresh;
    if (typeof token !== "string" || typeof refreshToken !== "string") {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    const payload = jwt.verify(token, env.ADMIN_JWT_SECRET);
    if (typeof payload === "string" || payload.kind !== "access" || !payload.sub) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    const admin = await AdminUser.findById(payload.sub)
      .select("_id email role +refreshTokenHash +refreshTokenExpiresAt")
      .exec();
    const presentedHash = hashToken(refreshToken);
    if (
      !admin ||
      !admin.refreshTokenHash ||
      !admin.refreshTokenExpiresAt ||
      admin.refreshTokenExpiresAt <= new Date() ||
      admin.refreshTokenHash.length !== presentedHash.length ||
      !timingSafeEqual(Buffer.from(admin.refreshTokenHash), Buffer.from(presentedHash))
    ) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    const activity = await AdminUser.updateOne(
      {
        _id: admin._id,
        refreshTokenHash: admin.refreshTokenHash,
        refreshTokenExpiresAt: { $gt: new Date() },
      },
      { $set: { refreshTokenExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) } },
    ).exec();
    if (activity.matchedCount !== 1) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    request.admin = { id: String(admin._id), email: admin.email, role: admin.role as AdminRole };
    next();
  } catch {
    response.status(401).json({ error: "Authentication required" });
  }
};

export function requireRole(...roles: AdminRole[]): RequestHandler {
  return (request, response, next) => {
    if (!request.admin || !roles.includes(request.admin.role)) {
      response.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
