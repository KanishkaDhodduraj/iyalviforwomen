import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { authApi, signedInThisSessionKey } from "./api";
import { LoginPage, ProtectedRoute } from "./auth";

function renderProtected(initialEntry = "/private") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<h1>Login page</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/private" element={<h1>Protected workspace</h1>} />
            <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
            <Route path="/staff" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("admin session navigation", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.removeItem(signedInThisSessionKey);
    vi.restoreAllMocks();
  });

  it("shows login at / without the session flag and does not request /me", async () => {
    const me = vi.spyOn(authApi, "me");
    renderProtected("/");
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeTruthy();
    expect(me).not.toHaveBeenCalled();
  });

  it("redirects every protected route to login without the session flag", async () => {
    const me = vi.spyOn(authApi, "me");
    renderProtected("/private");
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeTruthy();
    expect(me).not.toHaveBeenCalled();
  });

  it("verifies an existing session flag with /me and sends / to the dashboard", async () => {
    sessionStorage.setItem(signedInThisSessionKey, "true");
    vi.spyOn(authApi, "me").mockResolvedValue({
      admin: { id: "admin-1", email: "admin@example.com", role: "superadmin" },
    });
    renderProtected("/");
    expect(await screen.findByRole("heading", { name: "Dashboard page" })).toBeTruthy();
  });

  it("redirects /staff to the dashboard when signed in", async () => {
    sessionStorage.setItem(signedInThisSessionKey, "true");
    vi.spyOn(authApi, "me").mockResolvedValue({
      admin: { id: "admin-1", email: "admin@example.com", role: "superadmin" },
    });
    renderProtected("/staff");
    expect(await screen.findByRole("heading", { name: "Dashboard page" })).toBeTruthy();
  });

  it("sends a successful login to the dashboard and stores only the session boolean", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(authApi, "login").mockResolvedValue({
      admin: { id: "admin-1", email: "admin@example.com", role: "manager" },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("heading", { name: "Dashboard page" })).toBeTruthy();
    expect(sessionStorage.getItem(signedInThisSessionKey)).toBe("true");
    expect(sessionStorage.length).toBe(1);
  });
});
