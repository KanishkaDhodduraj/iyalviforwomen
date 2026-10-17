import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { customerNavigation } from "@/lib/customer-navigation";
import { Route as AboutRoute } from "@/routes/about";
import { Route as OffersRoute } from "@/routes/offers";
import { Route as StyleReelsRoute } from "@/routes/style-reels";
import { Route as LoveNotesRoute } from "@/routes/love-notes";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("keeps the five customer navigation links in the requested order", () => {
    expect(customerNavigation.map(({ label }) => label)).toEqual([
      "New Arrivals",
      "Sarees",
      "Kurtis",
      "Trend Talks",
      "Contact",
    ]);
  });

  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([
    "/sarees",
    "/kurtis",
    "/checkout",
    "/new-arrivals",
    "/trend-talks",
    "/my-orders",
    "/contact",
  ])("matches the %s route", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes(path);

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([AboutRoute, OffersRoute])("redirects removed pages to home", (route) => {
    expect(() => route.options.beforeLoad?.({} as never)).toThrowError(
      expect.objectContaining({ options: expect.objectContaining({ to: "/" }) }),
    );
  });

  it("redirects old Trend Talks links and removes Love Notes navigation", () => {
    expect(() => StyleReelsRoute.options.beforeLoad?.({} as never)).toThrowError(
      expect.objectContaining({ options: expect.objectContaining({ to: "/trend-talks" }) }),
    );
    expect(() => LoveNotesRoute.options.beforeLoad?.({} as never)).toThrowError(
      expect.objectContaining({ options: expect.objectContaining({ to: "/" }) }),
    );
    expect(customerNavigation.some(({ label }) => /love notes/i.test(label))).toBe(false);
  });
});
