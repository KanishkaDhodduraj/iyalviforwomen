import express from "express";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { configuredLimit, createLimiter } from "./rateLimit.js";

describe("customer rate limit groups", () => {
  it("uses the specified read and strict authentication limits", () => {
    expect(configuredLimit(300, true, "test")).toBe(300);
    expect(configuredLimit(120, true, "test")).toBe(120);
    expect(configuredLimit(10, false, "development")).toBe(10);
    expect(configuredLimit(300, true, "development")).toBe(3000);
    expect(configuredLimit(120, true, "development")).toBe(1200);
  });

  it("returns JSON and Retry-After and keys clients using the trusted proxy IP", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.get("/read", createLimiter(1, 60_000, false), (_request, response) => {
      response.json({ ok: true });
    });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const headers = { "x-forwarded-for": "198.51.100.10" };
      expect((await fetch(`${baseUrl}/read`, { headers })).status).toBe(200);
      const limited = await fetch(`${baseUrl}/read`, { headers });
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
      expect(await limited.json()).toEqual({
        message: "Too many requests, please wait a moment",
      });
      expect((await fetch(`${baseUrl}/read`, {
        headers: { "x-forwarded-for": "198.51.100.11" },
      })).status).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
