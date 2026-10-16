import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminApiClient } from "./api";

const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json" },
});

describe("AdminApiClient", () => {
  afterEach(() => {
    document.cookie = "admin_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    vi.restoreAllMocks();
  });

  it("sends cookies and CSRF headers, then refreshes and retries an expired session once", async () => {
    document.cookie = "admin_csrf=csrf%20value; path=/";
    const fetcher = vi.fn< typeof fetch>()
      .mockResolvedValueOnce(ok({ error: "Session expired" }, 401))
      .mockResolvedValueOnce(ok({ admin: { id: "a1", email: "admin@example.com", role: "manager" } }))
      .mockResolvedValueOnce(ok({ items: [{ id: "p1" }] }));
    const client = new AdminApiClient(fetcher);

    await expect(client.get<{ items: unknown[] }>("/products")).resolves.toEqual({ items: [{ id: "p1" }] });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
    expect(fetcher.mock.calls[1]?.[0]).toBe("/api/auth/refresh");
    expect(fetcher.mock.calls[1]?.[1]?.credentials).toBe("include");
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get("x-csrf-token")).toBe("csrf value");
    expect(fetcher.mock.calls[2]?.[0]).toBe("/api/products");
  });

  it("does not store a token or retry a login request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok({ error: "Invalid credentials" }, 401));
    const client = new AdminApiClient(fetcher);

    await expect(client.post("/auth/login", { email: "a@example.com", password: "bad" })).rejects.toThrow("Invalid credentials");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(window.localStorage.length).toBe(0);
  });

  it("returns a helpful offline message when the API cannot be reached", async () => {
    const client = new AdminApiClient(vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Network error")));
    await expect(client.get("/dashboard")).rejects.toThrow(/offline or unreachable/i);
  });
});
