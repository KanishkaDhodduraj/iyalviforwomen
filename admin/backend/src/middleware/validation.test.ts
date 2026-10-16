import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { emptyBody, emptyQuery } from "./validation.js";

function run(middleware: typeof emptyBody, value: Record<string, unknown>, key: "body" | "query") {
  let error: unknown;
  const request = { [key]: value } as unknown as Request;
  middleware(request, {} as Response, (nextError?: unknown) => {
    error = nextError;
  });
  return error;
}

describe("strict empty request validation", () => {
  it("rejects unexpected query keys", () => {
    expect(run(emptyQuery, { admin: true }, "query")).toBeDefined();
  });

  it("rejects unexpected body keys", () => {
    expect(run(emptyBody, { role: "superadmin" }, "body")).toBeDefined();
  });

  it("accepts empty body and query objects", () => {
    expect(run(emptyBody, {}, "body")).toBeUndefined();
    expect(run(emptyQuery, {}, "query")).toBeUndefined();
  });
});
