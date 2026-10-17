import express, { type Express } from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { reelModel, reviewModel, audit } = vi.hoisted(() => ({
  reelModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    bulkWrite: vi.fn(),
  },
  reviewModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
  audit: vi.fn(),
}));

vi.mock("../models/Reel.js", () => ({ Reel: reelModel }));
vi.mock("../models/Review.js", () => ({ Review: reviewModel }));
vi.mock("../middleware/audit.js", () => ({ writeAudit: audit }));
vi.mock("../middleware/auth.js", () => ({
  requireCsrf: (request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (request.get("x-csrf-token") !== "valid-token") {
      response.status(403).json({ error: "Request verification failed" });
      return;
    }
    next();
  },
  requireRole: (...roles: string[]) => (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const admin = request.admin as { role?: string } | undefined;
    if (!admin || !roles.includes(admin.role ?? "")) {
      response.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  },
}));

import { reelsRouter } from "./reels.js";
import { reviewsRouter } from "./reviews.js";

function queryChain<T>(result: T) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["sort", "skip", "limit", "populate", "lean"]) chain[method] = vi.fn(() => chain);
  chain.exec = vi.fn().mockResolvedValue(result);
  return chain;
}

describe("admin Reel and Review APIs", () => {
  let server: ReturnType<Express["listen"]>;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((request, _response, next) => {
      request.admin = { id: "admin-id", email: "admin@example.com", role: "manager" };
      next();
    });
    app.use("/reels", reelsRouter);
    app.use("/reviews", reviewsRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("lists reels with pagination and filter support", async () => {
    reelModel.find.mockReturnValue(queryChain([{ title: "Spring edit" }]));
    reelModel.countDocuments.mockReturnValue({ exec: vi.fn().mockResolvedValue(1) });
    const response = await fetch(`${baseUrl}/reels?isActive=true`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ title: "Spring edit" }], page: 1, total: 1 });
    expect(reelModel.find).toHaveBeenCalledWith({ isActive: true });
  });

  it("requires CSRF for reel creation, validates the Instagram URL, and audits successful changes", async () => {
    const body = {
      title: "Spring edit",
      instagramUrl: "https://instagram.com/reel/Ab_123",
    };
    const noCsrf = await fetch(`${baseUrl}/reels`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(noCsrf.status).toBe(403);
    expect(reelModel.create).not.toHaveBeenCalled();

    const invalid = await fetch(`${baseUrl}/reels`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "valid-token" },
      body: JSON.stringify({ ...body, instagramUrl: "https://not-instagram.test/reel/not-a-reel" }),
    });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    expect(reelModel.create).not.toHaveBeenCalled();

    reelModel.create.mockResolvedValue({
      _id: "0123456789abcdef01234567",
      ...body,
      shortcode: "Ab_123",
      instagramUrl: "https://www.instagram.com/reel/Ab_123/",
    });
    const created = await fetch(`${baseUrl}/reels`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "valid-token" },
      body: JSON.stringify(body),
    });
    expect(created.status).toBe(201);
    expect(reelModel.create).toHaveBeenCalledWith({
      title: "Spring edit",
      order: 0,
      isActive: true,
      shortcode: "Ab_123",
      instagramUrl: "https://www.instagram.com/reel/Ab_123/",
    });
    expect(audit).toHaveBeenCalledWith(expect.any(Object), "create", "Reel", "0123456789abcdef01234567");
  });

  it("updates a reel from a pasted Instagram post link and stores its shortcode", async () => {
    reelModel.findByIdAndUpdate.mockReturnValue(queryChain({
      _id: "0123456789abcdef01234567",
      title: "Updated",
      shortcode: "Post_45",
      instagramUrl: "https://www.instagram.com/p/Post_45/",
    }));
    const response = await fetch(`${baseUrl}/reels/0123456789abcdef01234567`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": "valid-token" },
      body: JSON.stringify({ title: "Updated", instagramUrl: "https://instagram.com/p/Post_45?utm_source=x" }),
    });
    expect(response.status).toBe(200);
    expect(reelModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "0123456789abcdef01234567",
      { $set: { title: "Updated", shortcode: "Post_45", instagramUrl: "https://www.instagram.com/p/Post_45/" } },
      { new: true, runValidators: true },
    );
  });

  it("approves and audits reviews", async () => {
    reviewModel.findByIdAndUpdate.mockReturnValue(queryChain({ _id: "0123456789abcdef01234567", status: "approved" }));
    const response = await fetch(`${baseUrl}/reviews/0123456789abcdef01234567/approve`, {
      method: "POST",
      headers: { "x-csrf-token": "valid-token" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ item: { status: "approved" } });
    expect(reviewModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "0123456789abcdef01234567",
      { $set: { status: "approved" } },
      { new: true, runValidators: true },
    );
    expect(audit).toHaveBeenCalledWith(expect.any(Object), "approve", "Review", "0123456789abcdef01234567");
  });
});
