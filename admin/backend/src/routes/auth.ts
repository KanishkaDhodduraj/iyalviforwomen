import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { cookieOptions, hashToken, requireAdmin, requireCsrf } from "../middleware/auth.js";
import { AuditLog } from "../models/AuditLog.js";
import { AdminUser } from "../models/AdminUser.js";
import { emptyBody, emptyQuery } from "../middleware/validation.js";

const router = Router();
const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
}).strict();
const dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);

function issueAccess(admin: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { email: admin.email, role: admin.role, kind: "access" },
    env.ADMIN_JWT_SECRET,
    { subject: admin.id, expiresIn: "30m" },
  );
}

function issueRefresh(adminId: string): string {
  return jwt.sign(
    { kind: "refresh", nonce: randomBytes(32).toString("hex") },
    env.ADMIN_JWT_SECRET,
    { subject: adminId, expiresIn: "7d" },
  );
}

function setSessionCookies(
  response: Parameters<import("express").RequestHandler>[1],
  access: string,
  refresh: string,
): void {
  response.cookie("admin_access", access, { ...cookieOptions, maxAge: 30 * 60 * 1000 });
  response.cookie("admin_refresh", refresh, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

router.post("/login", emptyQuery, requireCsrf, async (request, response) => {
  const input = loginSchema.parse(request.body);
  const admin = await AdminUser.findOne({ email: input.email.toLowerCase() })
    .select("+passwordHash +failedLoginAttempts +lockUntil")
    .exec();
  const passwordHash = admin?.passwordHash ?? dummyPasswordHash;
  const valid = await bcrypt.compare(input.password, passwordHash);
  const isLocked = Boolean(admin?.lockUntil && admin.lockUntil > new Date());
  if (!admin || !valid || isLocked) {
    if (admin && !isLocked) {
      admin.failedLoginAttempts += 1;
      if (admin.failedLoginAttempts >= 5) admin.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await admin.save();
    }
    await AuditLog.create({
      actorEmail: input.email.toLowerCase(),
      action: "login_failed",
      targetType: "AdminUser",
      ip: request.ip ?? "unknown",
    });
    response.status(401).json({ error: "Invalid email or password" });
    return;
  }
  admin.failedLoginAttempts = 0;
  admin.lockUntil = undefined;
  const refresh = issueRefresh(String(admin._id));
  admin.refreshTokenHash = hashToken(refresh);
  admin.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await admin.save();
  const details = { id: String(admin._id), email: admin.email, role: admin.role };
  await AuditLog.create({
    actor: admin._id,
    actorEmail: admin.email,
    action: "login",
    targetType: "AdminUser",
    targetId: String(admin._id),
    ip: request.ip ?? "unknown",
  });
  setSessionCookies(response, issueAccess(details), refresh);
  response.json({ admin: details });
});

router.post("/refresh", emptyBody, emptyQuery, requireCsrf, async (request, response) => {
  const refresh = request.cookies?.admin_refresh;
  if (typeof refresh !== "string") {
    response.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = jwt.verify(refresh, env.ADMIN_JWT_SECRET);
    if (typeof payload === "string" || payload.kind !== "refresh" || !payload.sub) throw new Error();
    const nextRefresh = issueRefresh(payload.sub);
    const admin = await AdminUser.findOneAndUpdate(
      {
        _id: payload.sub,
        refreshTokenHash: hashToken(refresh),
        refreshTokenExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          refreshTokenHash: hashToken(nextRefresh),
          refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      { new: true },
    ).exec();
    if (!admin) throw new Error();
    const details = { id: String(admin._id), email: admin.email, role: admin.role };
    await AuditLog.create({
      actor: admin._id,
      actorEmail: admin.email,
      action: "refresh",
      targetType: "AdminUser",
      targetId: String(admin._id),
      ip: request.ip ?? "unknown",
    });
    setSessionCookies(response, issueAccess(details), nextRefresh);
    response.json({ admin: details });
  } catch {
    response.clearCookie("admin_access", cookieOptions);
    response.clearCookie("admin_refresh", cookieOptions);
    response.status(401).json({ error: "Authentication required" });
  }
});

router.get("/me", emptyQuery, emptyBody, requireAdmin, (request, response) => {
  response.json({ admin: request.admin });
});

router.post("/logout", emptyBody, emptyQuery, requireAdmin, requireCsrf, async (request, response) => {
  await AdminUser.updateOne(
    { _id: request.admin!.id },
    { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } },
  ).exec();
  response.clearCookie("admin_access", cookieOptions);
  response.clearCookie("admin_refresh", cookieOptions);
  await AuditLog.create({
    actor: request.admin!.id,
    actorEmail: request.admin!.email,
    action: "logout",
    targetType: "AdminUser",
    targetId: request.admin!.id,
    ip: request.ip ?? "unknown",
  });
  response.status(204).end();
});

export { router as authRouter };
