import { z } from "zod";

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
  path: ["newPassword"],
  message: "New password must differ from the current password",
});

export function nextPasswordFailure(
  failedAttempts: number,
  now = new Date(),
): { failedAttempts: number; lockUntil?: Date } {
  const nextAttempts = failedAttempts + 1;
  return {
    failedAttempts: nextAttempts,
    ...(nextAttempts >= 5 && { lockUntil: new Date(now.getTime() + 15 * 60 * 1000) }),
  };
}
