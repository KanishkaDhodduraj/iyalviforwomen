import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, apiProductForCartItem, apiRequest, getAllProducts, type ApiProduct } from "./api";

const jsonResponse = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

describe("API client", () => {
  beforeEach(() => {
    api.clearCsrf();
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

  it("maps legacy locally stored cart ids to their seeded server products", () => {
    const seededProduct = {
      _id: "507f1f77bcf86cd799439011",
      slug: "iy-001-mayil-peacock-teal-saree",
    } as ApiProduct;

    expect(apiProductForCartItem("iy-001", [seededProduct])).toBe(seededProduct);
    expect(apiProductForCartItem(seededProduct._id, [seededProduct])).toBe(seededProduct);
    expect(apiProductForCartItem("iy-010", [seededProduct])).toBeUndefined();
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
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products?category=saree&page=1&limit=50");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/products?category=saree&page=2&limit=50");
  });
});
