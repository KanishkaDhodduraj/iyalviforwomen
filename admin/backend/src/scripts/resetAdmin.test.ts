import { describe, expect, it, vi } from "vitest";
import { resetAdmin, type ResetAdminStore } from "./resetAdmin.js";

function createStore(exists: boolean) {
  const store: ResetAdminStore = {
    hashPassword: vi.fn().mockResolvedValue("hashed-password"),
    findByEmail: vi.fn().mockResolvedValue(exists),
    updateExisting: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
  };
  return store;
}

describe("resetAdmin", () => {
  it("promotes an existing admin, replaces credentials, and clears lockout and refresh tokens", async () => {
    const store = createStore(true);
    const result = await resetAdmin(
      { NODE_ENV: "development", ADMIN_EMAIL: "  ADMIN@Example.com ", ADMIN_PASSWORD: "new-password" },
      store,
    );

    expect(result).toBe("Admin password reset");
    expect(store.hashPassword).toHaveBeenCalledWith("new-password", 12);
    expect(store.findByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(store.updateExisting).toHaveBeenCalledWith("admin@example.com", {
      $set: { role: "superadmin", passwordHash: "hashed-password", failedLoginAttempts: 0 },
      $unset: { lockUntil: 1, refreshTokenHash: 1, refreshTokenExpiresAt: 1 },
    });
    expect(store.create).not.toHaveBeenCalled();
  });

  it("creates a superadmin when the email does not exist", async () => {
    const store = createStore(false);
    const result = await resetAdmin(
      { NODE_ENV: "development", ADMIN_EMAIL: " Admin@Example.com ", ADMIN_PASSWORD: "password8" },
      store,
    );

    expect(result).toBe("Admin created");
    expect(store.create).toHaveBeenCalledWith({
      email: "admin@example.com",
      passwordHash: "hashed-password",
      role: "superadmin",
      failedLoginAttempts: 0,
    });
    expect(store.updateExisting).not.toHaveBeenCalled();
  });

  it("refuses production without reading credentials or touching the store", async () => {
    const store = createStore(true);

    await expect(resetAdmin({ NODE_ENV: "production" }, store)).rejects.toThrow(
      "Admin reset is disabled in production.",
    );
    expect(store.hashPassword).not.toHaveBeenCalled();
    expect(store.findByEmail).not.toHaveBeenCalled();
  });

  it("rejects passwords shorter than eight characters", async () => {
    const store = createStore(false);

    await expect(
      resetAdmin(
        { NODE_ENV: "development", ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "1234567" },
        store,
      ),
    ).rejects.toThrow(/at least 8 characters/);
    expect(store.hashPassword).not.toHaveBeenCalled();
  });
});
