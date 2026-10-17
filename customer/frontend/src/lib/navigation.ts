const topLevelSections = new Set([
  "/new-arrivals",
  "/sarees",
  "/kurtis",
  "/trend-talks",
  "/contact",
]);

export function navigateBackOrHome(
  pathname: string,
  historyLength: number,
  back: () => void,
  goHome: () => void,
): void {
  if (topLevelSections.has(pathname)) {
    goHome();
    return;
  }
  if (historyLength > 1) back();
  else goHome();
}
