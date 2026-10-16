import { randomInt, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import type { RequestHandler } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { HttpError } from "../middleware/errors.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { OtpCode } from "../models/OtpCode.js";
import { OtpSendWindow } from "../models/OtpSendWindow.js";
import { User } from "../models/User.js";
import {
  clearSessionCookies,
  issueSession,
  revokeSession,
  rotateSession,
  sessionUser,
} from "../services/sessions.js";
import { getOtpProvider } from "../services/otpProvider.js";

const dummyPasswordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);

export const register: RequestHandler = async (request, response) => {
  const { name, email, password } = request.body as { name: string; email: string; password: string };
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({ name, email, passwordHash });
    await issueSession(user, response);
    response.status(201).json({ user: sessionUser(user) });
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(409, "An account with this email already exists");
    throw error;
  }
};

export const login: RequestHandler = async (request, response) => {
  const { email, password } = request.body as { email: string; password: string };
  const user = await User.findOne({ email }).select("+passwordHash +failedLoginAttempts +lockUntil").exec();
  const hash = user?.passwordHash ?? dummyPasswordHash;
  const passwordMatches = await bcrypt.compare(password, hash);
  const locked = Boolean(user?.lockUntil && user.lockUntil > new Date());
  if (!user || !user.passwordHash || !passwordMatches || locked) {
    if (user && !locked) {
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { failedLoginAttempts: 1 } },
        { new: true },
      )
        .select("+failedLoginAttempts")
        .exec();
      if ((updated?.failedLoginAttempts ?? 0) >= 5) {
        await User.updateOne(
          { _id: user._id, failedLoginAttempts: { $gte: 5 } },
          { $set: { lockUntil: new Date(Date.now() + 15 * 60 * 1000) } },
        ).exec();
      }
    }
    throw new HttpError(401, "Invalid credentials");
  }

  await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } });
  await issueSession(user, response);
  response.json({ user: sessionUser(user) });
};

export const sendPhoneOtp: RequestHandler = async (request, response) => {
  const { phone } = request.body as { phone: string };
  const provider = getOtpProvider();
  const now = new Date();
  const active = await OtpSendWindow.findOneAndUpdate(
    { phone, windowEndsAt: { $gt: now }, sendCount: { $lt: 3 } },
    { $inc: { sendCount: 1 } },
    { new: true },
  ).exec();
  if (!active) {
    const reset = await OtpSendWindow.findOneAndUpdate(
      { phone, windowEndsAt: { $lte: now } },
      { $set: { sendCount: 1, windowEndsAt: new Date(now.getTime() + 60 * 60 * 1000) } },
      { new: true },
    ).exec();
    if (!reset) {
      try {
        await OtpSendWindow.create({
          phone,
          sendCount: 1,
          windowEndsAt: new Date(now.getTime() + 60 * 60 * 1000),
        });
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        throw new HttpError(429, "Too many OTP requests");
      }
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await OtpCode.updateMany({ phone, consumedAt: { $exists: false } }, { $set: { consumedAt: now } });
  await OtpCode.create({
    phone,
    codeHash: await bcrypt.hash(code, 12),
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    attempts: 0,
  });
  await provider.send(phone, code);
  response.status(202).json({ message: "If this phone can receive a code, one has been sent" });
};

export const verifyPhoneOtp: RequestHandler = async (request, response) => {
  const { phone, code } = request.body as { phone: string; code: string };
  const now = new Date();
  const otp = await OtpCode.findOneAndUpdate(
    { phone, expiresAt: { $gt: now }, attempts: { $lt: 5 }, consumedAt: { $exists: false } },
    { $inc: { attempts: 1 } },
    { new: true },
  )
    .select("+codeHash")
    .exec();
  if (!otp?.codeHash || !(await bcrypt.compare(code, otp.codeHash))) {
    throw new HttpError(401, "Invalid or expired code");
  }

  const consumed = await OtpCode.updateOne(
    { _id: otp._id, consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
  );
  if (consumed.modifiedCount !== 1) throw new HttpError(401, "Invalid or expired code");

  const user = await User.findOne({ phone }).exec();
  if (!user) throw new HttpError(401, "Invalid or expired code");
  user.isVerified = true;
  await user.save();
  await issueSession(user, response);
  response.json({ user: sessionUser(user) });
};

export const me: RequestHandler = async (request, response) => {
  const id = (request as AuthenticatedRequest).auth!.id;
  const user = await User.findById(id).exec();
  if (!user) throw new HttpError(401, "Authentication required");
  response.json({ user: sessionUser(user) });
};

export const updateMe: RequestHandler = async (request, response) => {
  const id = (request as AuthenticatedRequest).auth!.id;
  const { name } = z.object({ name: z.string().trim().min(1).max(100) }).strict().parse(request.body);
  const user = await User.findByIdAndUpdate(id, { $set: { name } }, { new: true, runValidators: true }).exec();
  if (!user) throw new HttpError(404, "Account not found");
  response.json({ user: sessionUser(user) });
};

export const logout: RequestHandler = async (request, response) => {
  await revokeSession(request.cookies?.refreshToken);
  clearSessionCookies(response);
  response.status(204).end();
};

export const refresh: RequestHandler = async (request, response) => {
  const token: unknown = request.cookies?.refreshToken;
  if (typeof token !== "string" || !(await rotateSession(token, response))) {
    clearSessionCookies(response);
    throw new HttpError(401, "Authentication required");
  }
  response.status(204).end();
};

export const csrfToken: RequestHandler = (_request, response) => {
  const csrf = randomBytes(32).toString("hex");
  response.cookie("csrfToken", csrf, {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
  response.json({ csrfToken: csrf });
};

export const requireUserId = (request: Request): string =>
  (request as AuthenticatedRequest).auth!.id;

function isDuplicateKey(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
