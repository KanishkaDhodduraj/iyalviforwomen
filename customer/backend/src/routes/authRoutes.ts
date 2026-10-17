import { Router } from "express";
import { z } from "zod";

import {
  csrfToken,
  login,
  logout,
  me,
  updateMe,
  refresh,
  register,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../controllers/authController.js";
import { HttpError } from "../middleware/errors.js";
import {
  authMeRateLimit,
  authRateLimit,
  loginRateLimit,
  registerRateLimit,
} from "../middleware/rateLimit.js";
import { csrfProtection, requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

const registerBody = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    password: z.string().min(8).max(128),
  })
  .strict();

const loginBody = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();

const googleBody = z.object({ idToken: z.string().min(1).max(8192) }).strict();
const phoneBody = z
  .object({ phone: z.string().regex(/^\+?[1-9]\d{7,14}$/) })
  .strict();
const verifyOtpBody = phoneBody
  .extend({ code: z.string().regex(/^\d{6}$/) })
  .strict();
const emptyBody = z.object({}).strict();

export const authRouter = Router();
authRouter.get(
  "/csrf",
  validateRequest({ query: z.object({}).strict() }),
  csrfToken,
);
authRouter.post(
  "/register",
  registerRateLimit,
  csrfProtection,
  validateRequest({ body: registerBody }),
  register,
);
authRouter.post(
  "/login",
  loginRateLimit,
  csrfProtection,
  validateRequest({ body: loginBody }),
  login,
);
authRouter.post(
  "/google",
  authRateLimit,
  validateRequest({ body: googleBody }),
  (_request, _response, next) =>
    next(new HttpError(501, "Google sign-in is unavailable")),
);
authRouter.post(
  "/otp/send",
  authRateLimit,
  csrfProtection,
  validateRequest({ body: phoneBody }),
  sendPhoneOtp,
);
authRouter.post(
  "/otp/verify",
  authRateLimit,
  csrfProtection,
  validateRequest({ body: verifyOtpBody }),
  verifyPhoneOtp,
);
authRouter.get(
  "/me",
  authMeRateLimit,
  validateRequest({ query: z.object({}).strict() }),
  requireAuth,
  me,
);
authRouter.patch(
  "/me",
  authRateLimit,
  csrfProtection,
  validateRequest({
    body: z.object({ name: z.string().trim().min(1).max(100) }).strict(),
  }),
  requireAuth,
  updateMe,
);
authRouter.post(
  "/logout",
  authRateLimit,
  csrfProtection,
  validateRequest({ body: emptyBody }),
  logout,
);
authRouter.post(
  "/refresh",
  authRateLimit,
  csrfProtection,
  validateRequest({ body: emptyBody }),
  refresh,
);
