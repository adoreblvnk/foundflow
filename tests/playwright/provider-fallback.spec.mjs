import { rmSync } from "node:fs";
import { expect, test } from "playwright/test";

const dataDir = "/tmp/foundflow-playwright-cli";

test.afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

test("case workspace exposes one provider-agnostic scan action", async ({ page }) => {
  process.env.DATA_DIR = dataDir;
  const { seedDemoCase } = await import("../../src/lib/db.ts");
  const demoCase = await seedDemoCase();

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
