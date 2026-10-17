import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

const mockState = vi.hoisted(() => ({
  secret: "test-only-admin-secret-at-least-32-characters",
  role: "manager",
  adminFindById: vi.fn(),
  adminUpdateOne: vi.fn(),
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
  it("does not expose promotion expiry without a configured cron secret", async () => {
    const response = await fetch(`${origin}/api/cron/expire-promotions`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Cron is not configured" });
  });

  it.each(["/api/messages", "/api/messages/unread-count"])(
    "returns 401 for unauthenticated GET %s requests",
    async (path) => {
      const response = await fetch(`${origin}${path}`);
      expect(response.status).toBe(401);
    },
  );

  it("does not expose the removed settings API to authenticated admins", async () => {
    const refresh = "current-session-refresh-token";
    const access = jwt.sign({ kind: "access" }, secret, { subject: "admin-id", expiresIn: "5m" });
    const headers = {
      Cookie: `admin_access=${access}; admin_refresh=${refresh}; admin_csrf=csrf-token`,
    };
    const response = await fetch(`${origin}/api/settings/store`, { headers });
    expect(response.status).toBe(404);
  });
});
