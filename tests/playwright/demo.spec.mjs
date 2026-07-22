import { rmSync } from "node:fs";
import { expect, test } from "playwright/test";

const dataDir = "/tmp/foundflow-playwright-cli";

test.afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

test("evidence-backed demo completes the custody workflow", async ({ page }) => {
  await page.goto("/cases");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Staff Identifier").fill("playwright-officer");
  await page.getByLabel("Security Password").fill("foundflow-playwright-password");
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await expect(page).toHaveURL(/\/cases$/);

  await page.getByRole("button", { name: "Load Demo Case" }).click();
  await page.getByRole("link", { name: "Open Case File →" }).click();
  await expect(page).toHaveURL(/\/cases\/FF-0241$/);
  await expect(page.getByText("Evidence Gallery (1)", { exact: true })).toBeVisible();
  await expect(page.getByText("11 records", { exact: true })).toBeVisible();
  await expect(page.getByText("SGD 104.00", { exact: true })).toBeVisible();
  await expect(page.getByText("MYR 50.40", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Entry" })).toHaveCount(5);

  const evidence = page.locator('img[alt="staged-found-property.webp"]');
  await expect(evidence).toBeVisible();
  expect(await evidence.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);

  await page.setViewportSize({ width: 375, height: 500 });
  await page.getByRole("button", { name: "+ Add Item Manually" }).click();
  const dialog = page.getByRole("dialog", { name: "Add New Manifest Record" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Item Label")).toBeFocused();
  const box = await dialog.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 501)).toBeLessThanOrEqual(500);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  const currencyDialog = page.getByRole("dialog", { name: "Edit Manifest Record" });
  await expect(currencyDialog.getByLabel("ISO currency code")).toHaveValue("SGD");
  await expect(currencyDialog.getByLabel("Currency denomination")).toHaveValue("1");
  await expect(currencyDialog.getByText("Total: SGD 3.00", { exact: true })).toBeVisible();
  await currencyDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(currencyDialog).toBeHidden();

  while (await page.getByRole("button", { name: "Confirm Entry" }).count()) {
    await page.getByRole("button", { name: "Confirm Entry" }).first().click();
    await expect(page.getByText(/Item confirmed/)).toBeVisible();
  }

  const finalise = page.getByRole("button", { name: "Approve and Finalise" });
  await expect(finalise).toBeEnabled();
  await finalise.click();
  await expect(page.getByText(/Custody Case Finalised & Approved/)).toBeVisible();

  const exports = await page.evaluate(async () => {
    const [jsonResponse, csvResponse] = await Promise.all([
      fetch("/api/cases/FF-0241/export/json", { cache: "no-store" }),
      fetch("/api/cases/FF-0241/export/csv", { cache: "no-store" }),
    ]);
    return {
      jsonStatus: jsonResponse.status,
      json: await jsonResponse.json(),
      csvStatus: csvResponse.status,
      csv: await csvResponse.text(),
    };
  });
  expect(exports.jsonStatus).toBe(200);
  expect(exports.csvStatus).toBe(200);
  expect(exports.json.manifest).toHaveLength(11);
  expect(exports.json.currencySummary).toEqual([
    { currencyCode: "MYR", total: 50.4 },
    { currencyCode: "SGD", total: 104 },
  ]);
  expect(exports.json.manifest.every((item) => item.evidenceId === "demo-evidence-1")).toBe(true);
  expect(exports.csv).toContain("Currency Code");
  expect(exports.csv).toContain("Case Currency Total");
  expect(exports.csv).toContain("104.00");
  expect(exports.csv).toContain("50.40");
  expect(exports.csv).toContain("SGD");
  expect(exports.csv).toContain("MYR");
  expect(exports.csv).toContain("SAMPLE-0241");

  await page.reload();
  await expect(page.getByText(/MANIFEST EXPORTED/).first()).toBeVisible();
});
