import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  apiProductForCartItem,
  apiRequest,
  getAllProducts,
  productFromApi,
  type ApiProduct,
} from "./api";

const jsonResponse = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

describe("API client", () => {
  beforeEach(() => {
    api.clearCsrf();
    api.clearPublicReadCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials and CSRF headers for mutations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: "csrf-value" }))
      .mockResolvedValueOnce(jsonResponse(201, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await api.post("/auth/login", { email: "person@example.com", password: "password123" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/csrf");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
    const mutationInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(mutationInit).toMatchObject({ credentials: "include", method: "POST" });
    expect(new Headers(mutationInit.headers).get("x-csrf-token")).toBe("csrf-value");
  });

  it("refreshes at most once and retries an unauthorized request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "Authentication required" }))
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: "csrf-value" }))
      .mockResolvedValueOnce(jsonResponse(204))
      .mockResolvedValueOnce(jsonResponse(200, { user: { id: "user-id" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiRequest<{ user: { id: string } }>("/auth/me");

    expect(response.user.id).toBe("user-id");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/auth/refresh");
  });

  it("explains that the backend is unavailable when the dev proxy returns 502", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(502, "Bad Gateway"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/products")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      message:
        "The backend service is unavailable. Start or check the backend server, then try again.",
    });
  });

  it("explains when the backend cannot be reached at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(api.get("/products")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      message:
        "Cannot reach the backend service. Start or check the backend server, then try again.",
    });
  });

  it("does not retry rate-limited requests and shows the friendly wait message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(429, { message: "Limited" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/products")).rejects.toMatchObject({
      name: "ApiError",
      status: 429,
      message: "Too many requests, please wait a moment",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("caches and deduplicates public product and reel reads for 60 seconds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { products: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { products: [{ _id: "fresh" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, concurrent] = await Promise.all([
      api.get("/products?sort=newest"),
      api.get("/products?sort=newest"),
    ]);
    const cached = await api.get("/products?sort=newest");

    expect(first).toBe(concurrent);
    expect(cached).toBe(first);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_001);
    try {
      await expect(api.get("/products?sort=newest")).resolves.toEqual({
        products: [{ _id: "fresh" }],
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps cart ids only to products returned by the server", () => {
    const seededProduct = {
      _id: "507f1f77bcf86cd799439011",
      slug: "iy-001-mayil-peacock-teal-saree",
    } as ApiProduct;

    expect(apiProductForCartItem(seededProduct._id, [seededProduct])).toBe(seededProduct);
    expect(apiProductForCartItem("iy-010", [seededProduct])).toBeUndefined();
  });

  it("maps discounted catalog prices and preserves image gallery order", () => {
    const product = productFromApi({
      _id: "507f1f77bcf86cd799439011",
      slug: "mayil-saree",
      name: "Mayil Saree",
      category: "saree",
      subCategory: "Silk",
      fabric: "Silk",
      colors: ["Teal"],
      sizes: ["Free Size"],
      price: 720,
      mrp: 1000,
      originalPrice: 1000,
      offerEndsAt: "2026-10-16T12:00:00.000Z",
      images: [
        { url: "/products/front.webp", alt: "Front view", isPrimary: true },
        { url: "/products/pallu.webp", alt: "Pallu detail", isPrimary: false },
      ],
      stock: 4,
      isActive: true,
    } as ApiProduct);

    expect(product.price).toBe(720);
    expect(product.originalPrice).toBe(1000);
    expect(product.image).toBe("/products/front.webp");
    expect(product.images).toEqual(["/products/front.webp", "/products/pallu.webp"]);
    expect(product.offerEndsAt).toBe("2026-10-16T12:00:00.000Z");
  });

  it("loads every product page for checkout and filters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          products: [{ _id: "one" }],
          page: 1,
          limit: 50,
          total: 51,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          products: [{ _id: "two" }],
          page: 2,
          limit: 50,
          total: 51,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAllProducts(new URLSearchParams({ category: "saree" }));

    expect(result.map((product) => product._id)).toEqual(["one", "two"]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/products?category=saree&sort=newest&page=1&limit=50",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/products?category=saree&sort=newest&page=2&limit=50",
    );
  });
});
