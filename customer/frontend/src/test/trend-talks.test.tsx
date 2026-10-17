import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrendTalksPage } from "@/components/iyalvi/community-pages";
import { api } from "@/lib/api";

function trendTalksRouter() {
  const rootRoute = createRootRoute();
  const talksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/trend-talks",
    component: TrendTalksPage,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([talksRoute]),
    history: createMemoryHistory({ initialEntries: ["/trend-talks"] }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  api.clearPublicReadCache();
});

describe("Trend Talks Instagram embeds", () => {
  it("lazy-loads every visible safe iframe and links to the original Instagram post", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      reels: [
        {
          _id: "reel-1",
          title: "Summer in motion",
          shortcode: "Ab_123",
          instagramUrl: "https://www.instagram.com/reel/Ab_123/",
          order: 0,
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          _id: "reel-2",
          title: "The festive edit",
          shortcode: "Cd_456",
          instagramUrl: "https://www.instagram.com/p/Cd_456/",
          order: 1,
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as never);
    render(<RouterProvider router={trendTalksRouter()} />);

    await waitFor(() => expect(document.querySelectorAll("iframe")).toHaveLength(2));
    const iframes = [...document.querySelectorAll("iframe")];
    expect(iframes.map((iframe) => iframe.getAttribute("src"))).toEqual([
      "https://www.instagram.com/reel/Ab_123/embed",
      "https://www.instagram.com/reel/Cd_456/embed",
    ]);
    for (const iframe of iframes) {
      expect(iframe).toHaveAttribute("loading", "lazy");
      expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
    }
    const links = screen.getAllByRole("link", { name: "See on Instagram" });
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveAttribute("href", "https://www.instagram.com/p/Cd_456/");
    expect(links[1]).toHaveAttribute("rel", "noopener noreferrer");
    expect(document.querySelector('script[src*="instagram"]')).not.toBeInTheDocument();
  });

  it("shows an empty state when no active reels are returned", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ reels: [] } as never);
    render(<RouterProvider router={trendTalksRouter()} />);
    expect(
      await screen.findByText("There are no Trend Talks just yet. Check back soon."),
    ).toBeInTheDocument();
  });
});
