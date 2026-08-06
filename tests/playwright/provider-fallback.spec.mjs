import { expect, test } from "playwright/test";

test("case workspace exposes one provider-agnostic scan action", async ({ page }) => {
  const seedResponse = await page.request.post("/api/testing/seed-demo");
  expect(seedResponse.ok()).toBe(true);
  const demoCase = await seedResponse.json();

  await page.goto("/cases");
  await page.getByLabel("Staff Identifier").fill("playwright-officer");
  await page.getByLabel("Security Password").fill("foundflow-playwright-password");
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await expect(page).toHaveURL(/\/cases$/);

  await page.goto(`/cases/${demoCase.id}`);
  const capturePanel = page.locator(".capture-panel");
  await expect(capturePanel.getByRole("button", { name: "Scan Item Photos", exact: true })).toHaveCount(1);
  await expect(capturePanel.getByRole("button", { name: /OpenAI|Agnes/i })).toHaveCount(0);
});
