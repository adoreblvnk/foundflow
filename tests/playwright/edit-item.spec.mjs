import { rmSync } from "node:fs";
import { expect, test } from "playwright/test";

const dataDir = "/tmp/foundflow-playwright-cli";

test.afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

test("changing an AI item's source does not retain boxes from the old photo", async ({ page }) => {
  process.env.DATA_DIR = dataDir;
  const { seedDemoCase } = await import("../../src/lib/db.ts");
  const demoCase = await seedDemoCase();
  const item = demoCase.manifest.find((candidate) => candidate.id !== "outer-item-root" && candidate.regions?.length);
  expect(item).toBeTruthy();

  await page.goto(`/cases/${demoCase.id}`);
  if (page.url().includes("/login")) {
    await page.getByLabel("Staff Identifier").fill("playwright-officer");
    await page.getByLabel("Security Password").fill("foundflow-playwright-password");
    await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
    await expect(page).toHaveURL(/\/cases/);
    await page.goto(`/cases/${demoCase.id}`);
  }

  await page.getByRole("button", { name: `Edit ${item.label}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Item" });
  await dialog.getByLabel("Source Photo").selectOption("staff-added");
  await dialog.getByRole("button", { name: "Save Changes" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(`Updated item "${item.label}" successfully.`)).toBeVisible();

  const updatedCase = await page.evaluate(async (caseId) => {
    const response = await fetch(`/api/cases/${caseId}`);
    return response.json();
  }, demoCase.id);
  const updatedItem = updatedCase.manifest.find((candidate) => candidate.id === item.id);
  expect(updatedItem.evidenceId).toBe("staff-added");
  expect(updatedItem.regions).toEqual([]);
  expect(updatedItem.status).toBe("review");
});
