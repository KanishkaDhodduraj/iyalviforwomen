import { timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "./errors.js";

const accessClaimsSchema = z.object({
  sub: z.string().regex(/^[a-f\d]{24}$/i),
  role: z.enum(["user", "admin"]),
  type: z.literal("access"),
});

interface ParsedCookieRequest extends Express.Request {
  cookies?: Record<string, unknown>;
}

export interface AuthenticatedRequest extends Express.Request {
  auth?: { id: string; role: "user" | "admin" };
}

async function attachAuth(request: Express.Request): Promise<boolean> {
  const token = (request as ParsedCookieRequest).cookies?.accessToken;
  if (typeof token !== "string") return false;
  let claims: z.infer<typeof accessClaimsSchema>;
  try {
    claims = accessClaimsSchema.parse(
      jwt.verify(token, env.JWT_SECRET, {
        issuer: "iyalvi-api",
        audience: "iyalvi-client",
      }),
    );
  } catch {
    return false;
  }
  const user = await User.findById(claims.sub).select("role isBlocked").lean().exec();
  if (!user || user.isBlocked) return false;
  (request as AuthenticatedRequest).auth = {
    id: String(user._id),
    role: user.role === "admin" ? "admin" : "user",
  };
  return true;
}

export const optionalAuth: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    await attachAuth(request);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    if (!(await attachAuth(request))) {
      next(new HttpError(401, "Authentication required"));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: Array<"user" | "admin">): RequestHandler {
  return (request, _response, next) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth || !roles.includes(auth.role)) {
      next(new HttpError(403, "Forbidden"));
      return;
    }
    next();
  };
}

export const csrfProtection: RequestHandler = (request, _response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  const cookie = (request as ParsedCookieRequest).cookies?.csrfToken;
  const header = request.get("x-csrf-token");
  if (
    typeof cookie !== "string" ||
    typeof header !== "string" ||
    cookie.length !== header.length ||
    !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))
  ) {
    next(new HttpError(403, "CSRF validation failed"));
    return;
  }
  next();
};
