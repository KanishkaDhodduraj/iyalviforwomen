import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

const mockState = vi.hoisted(() => ({
  secret: "test-only-admin-secret-at-least-32-characters",
  role: "manager",
  adminFindById: vi.fn(),
  adminUpdateOne: vi.fn(),
  settingFindOneAndUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

const secret = mockState.secret;

vi.mock("../config/env.js", () => ({
  env: {
    NODE_ENV: "test",
    ADMIN_CLIENT_URL: "http://localhost:8090",
    ADMIN_JWT_SECRET: mockState.secret,
    COOKIE_SAME_SITE: "lax",
    TRUST_PROXY: false,
  },
}));
vi.mock("../models/AdminUser.js", () => ({
  AdminUser: { findById: mockState.adminFindById, updateOne: mockState.adminUpdateOne },
}));
vi.mock("../models/Setting.js", () => ({
  Setting: { findOneAndUpdate: mockState.settingFindOneAndUpdate },
}));
vi.mock("../models/AuditLog.js", () => ({
  AuditLog: { create: mockState.auditCreate },
}));

const { app } = await import("../app.js");
let server: Server;
let origin: string;

beforeAll(async () => {
  const refresh = "current-session-refresh-token";
  const refreshHash = createHash("sha256").update(refresh).digest("hex");
  mockState.adminFindById.mockImplementation(() => ({
    select: () => ({
      exec: async () => ({
        _id: "admin-id",
        email: "admin@example.com",
        role: mockState.role,
        refreshTokenHash: refreshHash,
        refreshTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    }),
  }));
  mockState.adminUpdateOne.mockReturnValue({ exec: async () => ({ matchedCount: 1 }) });
  mockState.settingFindOneAndUpdate.mockReturnValue({
    lean: () => ({
      exec: async () => ({
        storeName: "Iyalvi",
        supportEmail: "",
        supportPhone: "",
        whatsappNumber: "",
        freeShippingThreshold: 999,
        lowStockThreshold: 5,
        currency: "INR",
      }),
    }),
  });
  mockState.auditCreate.mockResolvedValue(undefined);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start test server");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("admin API authentication", () => {
  it.each(["/api/settings/profile", "/api/settings/store", "/api/messages", "/api/messages/unread-count"])(
    "returns 401 for unauthenticated GET %s requests",
    async (path) => {
      const response = await fetch(`${origin}${path}`);
      expect(response.status).toBe(401);
    },
  );

  it("denies store edits to support admins and allows managers", async () => {
    const refresh = "current-session-refresh-token";
    const access = jwt.sign({ kind: "access" }, secret, { subject: "admin-id", expiresIn: "5m" });
    const headers = {
      "Content-Type": "application/json",
      Cookie: `admin_access=${access}; admin_refresh=${refresh}; admin_csrf=csrf-token`,
      "x-csrf-token": "csrf-token",
    };
    const body = JSON.stringify({
      storeName: "Iyalvi",
      supportEmail: "",
      supportPhone: "",
      whatsappNumber: "",
      freeShippingThreshold: 1200,
      lowStockThreshold: 5,
      currency: "INR",
    });

    mockState.role = "support";
    const denied = await fetch(`${origin}/api/settings/store`, { method: "PATCH", headers, body });
    expect(denied.status).toBe(403);

    mockState.role = "manager";
    const allowed = await fetch(`${origin}/api/settings/store`, { method: "PATCH", headers, body });
    expect(allowed.status).toBe(200);
    expect(mockState.settingFindOneAndUpdate).toHaveBeenCalledOnce();
  });
});
