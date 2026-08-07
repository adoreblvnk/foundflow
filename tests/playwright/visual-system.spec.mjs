import { expect, test } from "playwright/test";

const publicRoutes = ["/", "/about", "/challenge", "/guide", "/search"];
const caseRoutes = [
  "/cases",
  "/cases/new",
  "/cases/new/intake",
  "/cases/CT3A-20260721-DEMO",
  "/cases/CT3A-20260721-DEMO/upload",
  "/cases/CT3A-20260721-DEMO/scan",
  "/cases/CT3A-20260721-DEMO/review",
  "/cases/CT3A-20260721-DEMO/finalise",
  "/cases/CT3A-20260721-DEMO/claim",
];

async function expectVisualFoundation(page, route, compact) {
  await page.goto(route);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);

  const metrics = await page.evaluate(() => {
    const styles = getComputedStyle(document.body);
    const offenders = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const hasScrollContainer = (() => {
          let ancestor = element.parentElement;
          while (ancestor) {
            const overflowX = getComputedStyle(ancestor).overflowX;
            if (overflowX === "auto" || overflowX === "scroll") return true;
            ancestor = ancestor.parentElement;
          }
          return false;
        })();
        return rect.right > innerWidth + 1
          && !hasScrollContainer
          && style.position !== "fixed"
          && style.position !== "absolute"
          && style.overflowX !== "auto";
      })
      .slice(0, 5)
      .map((element) => ({ tag: element.tagName, className: element.className }));
    return {
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fontFamily: styles.fontFamily,
      purple: styles.getPropertyValue("--purple").trim(),
      offenders,
    };
  });

  expect(metrics.scrollWidth, `${route} document overflow at ${compact ? "compact" : "desktop"} width`).toBeLessThanOrEqual(metrics.width);
  expect(metrics.offenders, `${route} overflowing elements`).toEqual([]);
  expect(metrics.fontFamily).toContain("Lato");
  expect(metrics.purple).toBe("#7a35b0");
}

test("APIC-inspired visual foundation covers every public and workflow route", async ({ page }) => {
  const seedResponse = await page.request.post("/api/testing/seed-demo");
  expect(seedResponse.ok()).toBe(true);

  await page.context().clearCookies();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  await expect(page.locator(".portal-panel")).toBeVisible();
  await expectVisualFoundation(page, "/login", false);

  for (const route of publicRoutes) {
    await expectVisualFoundation(page, route, false);
    await expect(page.locator(".app-header")).toBeVisible();
  }

  await page.goto("/login");
  await page.getByLabel("Staff Identifier").fill("playwright-officer");
  await page.getByLabel("Security Password").fill("foundflow-playwright-password");
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await expect(page).toHaveURL(/\/cases$/);

  await page.goto("/cases/new");
  await page.getByText("I understand and will follow these instructions.", { exact: true }).click();
  await page.getByRole("button", { name: "Acknowledge & Continue" }).click();
  await expect(page).toHaveURL(/\/cases\/new\/intake$/);

  for (const route of caseRoutes) {
    await expectVisualFoundation(page, route, false);
    await expect(page.locator(".app-header")).toBeVisible();
  }

  await page.setViewportSize({ width: 375, height: 667 });
  for (const route of [...publicRoutes, ...caseRoutes]) {
    await expectVisualFoundation(page, route, true);
  }
});
