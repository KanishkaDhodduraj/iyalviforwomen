import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError, authApi } from "./api";
import { localAutoLoginDisabledKey, LoginPage, ProtectedRoute } from "./auth";

function renderProtected(initialEntry = "/private") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<h1>Login page</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<h1>Protected workspace</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProtectedRoute", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.removeItem(localAutoLoginDisabledKey);
    vi.restoreAllMocks();
  });

  it("automatically signs in to the local development admin account", async () => {
    vi.spyOn(authApi, "me")
      .mockRejectedValueOnce(new ApiError("Authentication required", 401))
      .mockResolvedValueOnce({
        admin: { id: "admin-1", email: "admin@example.com", role: "superadmin" },
      });
    const devLogin = vi.spyOn(authApi, "devLogin").mockResolvedValue({
      admin: { id: "admin-1", email: "admin@example.com", role: "superadmin" },
    });
    renderProtected();
    expect(await screen.findByRole("heading", { name: "Protected workspace" })).toBeTruthy();
    expect(devLogin).toHaveBeenCalledOnce();
  });

  it("does not auto-sign-in when the API is unreachable", async () => {
    vi.spyOn(authApi, "me").mockRejectedValue(new ApiError("Service unavailable"));
    const devLogin = vi.spyOn(authApi, "devLogin");
    renderProtected();
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeTruthy();
    expect(devLogin).not.toHaveBeenCalled();
  });

  it("does not auto-sign-in after an explicit local sign-out", async () => {
    sessionStorage.setItem(localAutoLoginDisabledKey, "true");
    vi.spyOn(authApi, "me").mockRejectedValue(new ApiError("Authentication required", 401));
    const devLogin = vi.spyOn(authApi, "devLogin");
    renderProtected();
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeTruthy();
    expect(devLogin).not.toHaveBeenCalled();
  });

  it("renders protected content after the session is verified", async () => {
    vi.spyOn(authApi, "me").mockResolvedValue({
      admin: { id: "admin-1", email: "admin@example.com", role: "manager" },
    });
    renderProtected();
    expect(await screen.findByRole("heading", { name: "Protected workspace" })).toBeTruthy();
  });

  it("does not show a stale offline message on the sign-in page", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(authApi, "me").mockRejectedValue(new ApiError("Admin service is offline"));
    vi.spyOn(authApi, "devLogin").mockRejectedValue(new ApiError("Admin service is offline"));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[{ pathname: "/login", state: { connectionIssue: "Backend was offline" } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByLabelText("Email address")).toBeTruthy();
    expect(screen.queryByText("Backend was offline")).toBeNull();
  });

  it("redirects an authenticated admin away from the sign-in page", async () => {
    vi.spyOn(authApi, "me").mockResolvedValue({
      admin: { id: "admin-1", email: "admin@example.com", role: "superadmin" },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<h1>Admin workspace</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Admin workspace" })).toBeTruthy();
  });
});
