import { describe, expect, it } from "vitest";
import { nextPasswordFailure, passwordChangeSchema } from "./passwordChange.js";

describe("admin password change rules", () => {
  it("requires a different password with at least ten characters, a letter, and a number", () => {
    expect(passwordChangeSchema.safeParse({
      currentPassword: "Current123",
      newPassword: "NewPassword123",
    }).success).toBe(true);
    for (const newPassword of ["short1A", "longpassword", "1234567890", "Current123"]) {
      expect(passwordChangeSchema.safeParse({
        currentPassword: "Current123",
        newPassword,
      }).success).toBe(false);
    }
  });

  it("starts a fifteen-minute lockout on the fifth wrong password", () => {
    const now = new Date("2026-10-17T00:00:00.000Z");
    expect(nextPasswordFailure(3, now)).toEqual({ failedAttempts: 4 });
    expect(nextPasswordFailure(4, now)).toEqual({
      failedAttempts: 5,
      lockUntil: new Date("2026-10-17T00:15:00.000Z"),
    });
  });
});
