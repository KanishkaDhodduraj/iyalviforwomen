import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { adminApi, authApi, signedInThisSessionKey } from "../api";
import { AdminRoutes } from "./App";

describe("admin layout logout", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.removeItem(signedInThisSessionKey);
    vi.restoreAllMocks();
  });

  it("clears the session flag, calls logout, and returns to login", async () => {
    sessionStorage.setItem(signedInThisSessionKey, "true");
    vi.spyOn(authApi, "me").mockResolvedValue({
      admin: { id: "admin-1", email: "admin@example.com", role: "manager" },
    });
    const logout = vi.spyOn(authApi, "logout").mockResolvedValue(undefined);
    vi.spyOn(adminApi, "get").mockResolvedValue({
      items: [],
      page: 1,
      limit: 25,
      total: 0,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/orders"]}>
          <AdminRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));
    expect(await screen.findByLabelText("Email address")).toBeTruthy();
    expect(logout).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(signedInThisSessionKey)).toBeNull();
  });
});
