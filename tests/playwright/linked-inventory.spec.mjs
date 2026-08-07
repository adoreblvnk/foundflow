import { expect, test } from "playwright/test";

test("linked inventory preserves hierarchy, source links and compact layout", async ({ page }) => {
  const seedResponse = await page.request.post("/api/testing/seed-demo");
  expect(seedResponse.ok()).toBe(true);
  const demoCase = await seedResponse.json();

  await page.goto(`/cases/${demoCase.id}`);
  if (page.url().includes("/login")) {
    await page.getByLabel("Staff Identifier").fill("playwright-officer");
    await page.getByLabel("Security Password").fill("foundflow-playwright-password");
    await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
    await expect(page).toHaveURL(/\/cases/);
    await page.goto(`/cases/${demoCase.id}`);
  }

  const inventory = page.getByRole("region", { name: "Item List" });
  await expect(inventory).toBeVisible();
  await expect(inventory.getByLabel("Inventory summary")).toContainText(`${demoCase.manifest.length} records`);
  await expect(inventory.getByText(/photo-linked objects boxed/)).toBeVisible();
  await expect(inventory.getByRole("list", { name: "Photo-linked item hierarchy" }).getByRole("listitem")).toHaveCount(demoCase.manifest.length);

  const root = demoCase.manifest.find((item) => item.id === "outer-item-root");
  const child = demoCase.manifest.find((item) => item.parentId === "outer-item-root");
  expect(root).toBeTruthy();
  expect(child).toBeTruthy();
  await expect(inventory.getByRole("article", { name: root.label, exact: true })).toBeVisible();
  await expect(inventory.getByRole("article", { name: `${child.label}, inside ${root.label}`, exact: true })).toBeVisible();

  await inventory.getByRole("button", { name: `Select ${child.label} in linked inventory` }).click();
  await expect(inventory.getByRole("article", { name: `${child.label}, inside ${root.label}`, exact: true })).toHaveClass(/selected/);

  await page.setViewportSize({ width: 375, height: 667 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(inventory.getByRole("button", { name: `Edit ${child.label}` })).toBeVisible();
});
