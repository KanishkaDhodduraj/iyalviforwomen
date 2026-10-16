import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { authApi } from "./api";
import { LoginPage, ProtectedRoute } from "./auth";

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
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated visitors to sign in", async () => {
    vi.spyOn(authApi, "me").mockRejectedValue(new Error("Unauthorized"));
    renderProtected();
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeTruthy();
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
});
