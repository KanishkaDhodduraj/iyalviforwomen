import { describe, expect, it, vi } from "vitest";
import { navigateBackOrHome } from "./navigation";

describe("browser Back navigation", () => {
  it("uses browser history when a previous entry exists", () => {
    const back = vi.fn();
    const goHome = vi.fn();
    navigateBackOrHome("/product/example", 2, back, goHome);
    expect(back).toHaveBeenCalledOnce();
    expect(goHome).not.toHaveBeenCalled();
  });

  it("falls back home when this is the first history entry", () => {
    const back = vi.fn();
    const goHome = vi.fn();
    navigateBackOrHome("/product/example", 1, back, goHome);
    expect(goHome).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
  });

  it("returns from every top-level section to Home instead of the previous section", () => {
    for (const section of ["/new-arrivals", "/sarees", "/kurtis", "/trend-talks", "/contact"]) {
      const back = vi.fn();
      const goHome = vi.fn();
      navigateBackOrHome(section, 3, back, goHome);
      expect(back).not.toHaveBeenCalled();
      expect(goHome).toHaveBeenCalledOnce();
    }
  });

  it("uses history from product and checkout pages", () => {
    const back = vi.fn();
    const goHome = vi.fn();
    navigateBackOrHome("/checkout", 2, back, goHome);
    expect(back).toHaveBeenCalledOnce();
    expect(goHome).not.toHaveBeenCalled();
  });
});
