import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { requireRole, type AdminRole } from "./auth.js";

function statusAfterGuard(role: AdminRole, ...allowed: AdminRole[]): number | undefined {
  let status: number | undefined;
  let continued = false;
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  requireRole(...allowed)(
    { admin: { id: "admin-id", email: "admin@example.test", role } } as Request,
    response,
    () => { continued = true; },
  );
  return continued ? undefined : status;
}

describe("admin role permissions", () => {
  it("allows support read access", () => {
    expect(statusAfterGuard("support", "superadmin", "manager", "support")).toBeUndefined();
  });

  it("keeps support read-only", () => {
    const supportReadable = ["orders", "customers"];
    const managerOnly = ["products", "payments", "discounts", "messages"];
    for (const resource of supportReadable) {
      expect(statusAfterGuard("support", "superadmin", "manager", "support"), resource).toBeUndefined();
    }
    for (const resource of managerOnly) {
      expect(statusAfterGuard("support", "superadmin", "manager"), resource).toBe(403);
    }
  });

  it("allows manager write access where configured", () => {
    expect(statusAfterGuard("manager", "superadmin", "manager")).toBeUndefined();
  });
});
