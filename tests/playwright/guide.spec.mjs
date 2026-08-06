import { expect, test } from "playwright/test";

test("guide explains the complete staff workflow on desktop and compact screens", async ({ page }) => {
  await page.goto("/guide");

  await expect(page.getByRole("heading", { name: "From found item to verified handover" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Complete workflow" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(17);
  await expect(page.getByRole("link", { name: "Start New Case" })).toHaveAttribute("href", "/cases/new");
  await expect(page.getByRole("link", { name: "Open Cases" })).toHaveAttribute("href", "/cases");
  await expect(page.getByRole("link", { name: "Search Items" })).toHaveAttribute("href", "/search");
  await expect(page.getByText(/AI output remains provisional/)).toBeVisible();
  await expect(page.getByText(/npm run demo:automated/)).toBeVisible();

  await page.getByRole("link", { name: "FoundFlow" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeFocused();

  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: "Guide", exact: true })).toBeVisible();
});
