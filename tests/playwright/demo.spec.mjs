import { rmSync } from "node:fs";
import { expect, test } from "playwright/test";

const dataDir = "/tmp/foundflow-playwright-cli";

test.afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

test("photo-linked demo completes the airport property workflow", async ({ page }) => {
  await page.goto("/");
  const kioskMode = page.getByRole("link", { name: /Kiosk Mode/ });
  const mobileMode = page.getByRole("link", { name: /Mobile Mode/ });
  await expect(kioskMode).toBeVisible();
  await expect(mobileMode).toBeVisible();
  await expect(kioskMode).not.toContainText(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u);
  await expect(mobileMode).not.toContainText(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u);

  await page.goto("/kiosk");
  await expect(page.getByRole("heading", { name: "Kiosk Intake" })).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u);

  await page.goto("/cases");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Staff Identifier").fill("playwright-officer");
  await page.getByLabel("Security Password").fill("foundflow-playwright-password");
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await expect(page).toHaveURL(/\/cases$/);

  await page.getByRole("button", { name: /Load Demo|Reset Demo/ }).click();
  await page.locator('a[href="/cases/CT3A-20260721-DEMO"]').first().click();
  await expect(page).toHaveURL(/\/cases\/CT3A-20260721-DEMO$/);
  await expect(page.getByText("Item Photos (1)", { exact: true })).toBeVisible();
  await expect(page.getByText("11 records", { exact: true })).toBeVisible();
  await expect(page.getByText("SGD 104.00", { exact: true })).toBeVisible();
  await expect(page.getByText("MYR 50.40", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm$/ })).toHaveCount(5);

  const chooseImage = page.getByRole("button", { name: "Choose Image" });
  const uploadPhoto = page.getByRole("button", { name: "Upload Photo" });
  await expect(chooseImage).toBeVisible();
  await expect(uploadPhoto).toBeDisabled();
  const photoInput = page.getByLabel("Select JPG / PNG / WebP");
  await photoInput.setInputFiles("public/demo/found-property-evidence.webp");
  await expect(page.getByText("found-property-evidence.webp", { exact: true })).toBeVisible();
  await expect(uploadPhoto).toBeEnabled();
  await photoInput.setInputFiles([]);
  await expect(page.getByText("No image selected", { exact: true })).toBeVisible();
  await expect(uploadPhoto).toBeDisabled();

  await page.goto("/cases/CT3A-20260721-DEMO/upload");
  await expect(page.getByRole("button", { name: "Choose Image or Take Photo" })).toBeVisible();
  await page.goto("/cases/CT3A-20260721-DEMO");

  const openCaseSearch = await page.evaluate(async () => {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "", mode: "text" }),
    });
    return response.json();
  });
  expect(openCaseSearch.results).toHaveLength(0);

  const photo = page.locator('img[alt="staged-found-property.webp"]');
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);

  await page.setViewportSize({ width: 375, height: 500 });
  await page.getByRole("button", { name: "+ Add Item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add Item" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Item Label")).toBeFocused();
  const box = await dialog.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 501)).toBeLessThanOrEqual(500);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  const currencyDialog = page.getByRole("dialog", { name: "Edit Item" });
  await expect(currencyDialog.getByLabel("ISO currency code")).toHaveValue("SGD");
  await expect(currencyDialog.getByLabel("Currency denomination")).toHaveValue("1");
  await expect(currencyDialog.getByText("Total: SGD 3.00", { exact: true })).toBeVisible();
  await currencyDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(currencyDialog).toBeHidden();

  while (await page.getByRole("button", { name: /Confirm$/ }).count()) {
    await page.getByRole("button", { name: /Confirm$/ }).first().click();
    await expect(page.getByText(/Item confirmed/)).toBeVisible();
  }

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  await page.getByRole("dialog", { name: "Edit Item" }).getByLabel("Quantity").fill("4");
  await page.getByRole("dialog", { name: "Edit Item" }).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: /Confirm$/ })).toHaveCount(1);
  await expect(page.getByText("SGD 105.00", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  await page.getByRole("dialog", { name: "Edit Item" }).getByLabel("Quantity").fill("3");
  await page.getByRole("dialog", { name: "Edit Item" }).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("SGD 104.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Confirm$/ }).click();

  const finalise = page.getByRole("button", { name: "Confirm & Complete" });
  await expect(finalise).toBeEnabled();
  await finalise.click();
  await expect(page.getByText(/Property Record Completed/)).toBeVisible();

  const completedCaseSearch = await page.evaluate(async () => {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "", mode: "text" }),
    });
    return response.json();
  });
  expect(completedCaseSearch.results).toHaveLength(11);
  expect(completedCaseSearch.results.every((item) => item.caseId === "CT3A-20260721-DEMO")).toBe(true);

  const exports = await page.evaluate(async () => {
    const [jsonResponse, csvResponse] = await Promise.all([
      fetch("/api/cases/CT3A-20260721-DEMO/export/json", { cache: "no-store" }),
      fetch("/api/cases/CT3A-20260721-DEMO/export/csv", { cache: "no-store" }),
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
    { currencyCode: "MYR", total: "50.4" },
    { currencyCode: "SGD", total: "104" },
  ]);
  expect(exports.json.manifest.every((item) => item.evidenceId === "demo-evidence-1")).toBe(true);
  expect(exports.json.manifest.filter((item) => item.itemType === "currency").map((item) => ({ code: item.currencyCode, denomination: item.denomination, quantity: item.quantity, total: item.currencyTotal }))).toEqual([
    { code: "SGD", denomination: "100", quantity: 1, total: "100" },
    { code: "SGD", denomination: "1", quantity: 3, total: "3" },
    { code: "SGD", denomination: "0.5", quantity: 2, total: "1" },
    { code: "MYR", denomination: "50", quantity: 1, total: "50" },
    { code: "MYR", denomination: "0.2", quantity: 2, total: "0.4" },
  ]);
  expect(exports.csv).toContain("Currency Code");
  expect(exports.csv).toContain("Case Currency Total");
  expect(exports.csv).toContain("104.00");
  expect(exports.csv).toContain("50.40");
  expect(exports.csv).toContain("SGD");
  expect(exports.csv).toContain("MYR");
  expect(exports.csv).toContain("SAMPLE-0241");

  await page.reload();
  await expect(page.getByText(/ITEM LIST EXPORTED/).first()).toBeVisible();
});
