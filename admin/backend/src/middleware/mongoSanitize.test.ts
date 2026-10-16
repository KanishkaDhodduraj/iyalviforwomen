import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { mongoSanitizeExpress5 } from "./mongoSanitize.js";

describe("Express 5 NoSQL sanitization middleware", () => {
  it("sanitizes the read-only query getter without returning an internal error", () => {
    const request = {
      body: {},
      params: {},
      headers: {},
    } as Request;
    const query = { "$where": "malicious", "profile.name": "unexpected", category: "saree" };
    Object.defineProperty(request, "query", {
      configurable: true,
      get: () => query,
    });
    const next = vi.fn();

    mongoSanitizeExpress5(request, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.query).toEqual({ category: "saree" });
  });
});
