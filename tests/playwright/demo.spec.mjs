import { rmSync } from "node:fs";
import { expect, test } from "playwright/test";

const dataDir = "/tmp/foundflow-playwright-cli";

test.afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

test("photo-linked demo completes the airport property workflow", async ({ page }) => {
  process.env.DATA_DIR = dataDir;
  const { seedDemoCase } = await import("../../src/lib/db.ts");
  await seedDemoCase();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Start Staff Intake/ })).toBeVisible();
  await expect(page.getByText(/Kiosk Mode/)).toHaveCount(0);

  await page.goto("/kiosk");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

  await page.goto("/cases");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Staff Identifier").fill("playwright-officer");
  await page.getByLabel("Security Password").fill("foundflow-playwright-password");
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await expect(page).toHaveURL(/\/cases$/);

  await expect(page.getByRole("button", { name: /Load Demo|Reset Demo/ })).toHaveCount(0);
  await page.locator('a[href="/cases/CT3A-20260721-DEMO"]').first().click();
  await expect(page).toHaveURL(/\/cases\/CT3A-20260721-DEMO$/);
  await expect(page.getByText("Item Photos (1)", { exact: true })).toBeVisible();
  await expect(page.getByText("11 records", { exact: true })).toBeVisible();
  await expect(page.getByText("SGD 104.00", { exact: true })).toBeVisible();
  await expect(page.getByText("MYR 50.40", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "First Check" })).toHaveCount(5);
  await expect(page.getByRole("region", { name: "Match records to the photo" })).toBeVisible();
  const verifierBox = await page.getByRole("region", { name: "Match records to the photo" }).boundingBox();
  const capturePanelBox = await page.locator(".capture-panel").boundingBox();
  const reviewPanelBox = await page.locator(".review-panel").boundingBox();
  expect(verifierBox?.x).toBeGreaterThanOrEqual(reviewPanelBox?.x ?? Number.MAX_SAFE_INTEGER);
  expect(verifierBox?.width).toBeGreaterThan(capturePanelBox?.width ?? Number.MAX_SAFE_INTEGER);

  await page.getByRole("button", { name: "Show Plain kraft notebook on source photo" }).click();
  await page.getByRole("button", { name: "+ Draw region" }).click();
  const regionPhoto = page.locator(".region-photo");
  const regionPhotoBox = await regionPhoto.boundingBox();
  expect(regionPhotoBox).not.toBeNull();
  await page.mouse.move(regionPhotoBox.x + regionPhotoBox.width * 0.72, regionPhotoBox.y + regionPhotoBox.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(regionPhotoBox.x + regionPhotoBox.width * 0.82, regionPhotoBox.y + regionPhotoBox.height * 0.25);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: /Plain kraft notebook, region/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Plain kraft notebook, region 2" }).click();
  await page.getByRole("button", { name: "Remove box" }).click();
  await expect(page.getByRole("button", { name: /Plain kraft notebook, region/ })).toHaveCount(1);
  await page.locator("article").filter({ hasText: "Plain kraft notebook" }).getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("button", { name: "First Check" })).toHaveCount(5);

  await expect(page.getByRole("button", { name: /Singapore 1-dollar specimen coins, region/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Show Singapore 1-dollar specimen coins on source photo" }).click();
  await page.getByRole("button", { name: "Singapore 1-dollar specimen coins, region 1" }).click();
  await page.getByLabel("Assign box to").selectOption("sgd-050-coins");
  await expect(page.getByRole("button", { name: /Singapore 50-cent specimen coins, region/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Singapore 50-cent specimen coins, region 3" }).click();
  await page.getByLabel("Assign box to").selectOption("sgd-1-coins");
  await expect(page.getByRole("button", { name: /Singapore 1-dollar specimen coins, region/ })).toHaveCount(3);

  const chooseImage = page.getByRole("button", { name: "Choose Image" });
  const uploadPhoto = page.getByRole("button", { name: "Upload Photo" });
  await expect(chooseImage).toBeVisible();
  await expect(uploadPhoto).toBeDisabled();
  const photoInput = page.getByLabel("Select JPG / PNG / WebP");
  const photoContext = page.getByLabel("Photo context");
  await expect(photoContext).toHaveValue("loose-item");
  await expect(photoContext.getByRole("option", { name: "Loose / standalone item (no container)" })).toHaveCount(1);
  await photoInput.setInputFiles("public/demo/found-property-evidence.webp");
  await expect(page.getByText("found-property-evidence.webp", { exact: true })).toBeVisible();
  await expect(uploadPhoto).toBeEnabled();
  await photoInput.setInputFiles([]);
  await expect(page.getByText("No image selected", { exact: true })).toBeVisible();
  await expect(uploadPhoto).toBeDisabled();

  await page.goto("/cases/CT3A-20260721-DEMO/upload");
  await expect(page.getByRole("button", { name: "Choose Image or Take Photo" })).toBeVisible();
  await expect(page.getByLabel("Photo context")).toHaveValue("loose-item");
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
  const modalMetrics = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    paddingLeft: parseFloat(getComputedStyle(element).paddingLeft),
  }));
  expect(modalMetrics.scrollWidth).toBeLessThanOrEqual(modalMetrics.clientWidth);
  expect(modalMetrics.paddingLeft).toBeGreaterThanOrEqual(20);
  const itemLabelPadding = await dialog.getByLabel("Item Label").evaluate((element) => parseFloat(getComputedStyle(element).paddingLeft));
  expect(itemLabelPadding).toBeGreaterThanOrEqual(12);
  const itemLabelBox = await dialog.getByLabel("Item Label").boundingBox();
  expect(itemLabelBox?.x).toBeGreaterThanOrEqual((box?.x ?? 0) + modalMetrics.paddingLeft - 1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 720 });

  for (const label of ["Identification card", "Chicken sandwich"]) {
    await page.getByRole("button", { name: "+ Add Item", exact: true }).click();
    const addDialog = page.getByRole("dialog", { name: "Add Item" });
    const desktopModalMetrics = await addDialog.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(desktopModalMetrics.clientWidth).toBeGreaterThanOrEqual(600);
    expect(desktopModalMetrics.scrollWidth).toBeLessThanOrEqual(desktopModalMetrics.clientWidth);
    await addDialog.getByLabel("Item Label").fill(label);
    await addDialog.getByRole("button", { name: "Add Item" }).click();
    await expect(addDialog).toBeHidden();
  }
  await expect(page.getByText("13 records", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "First Check" })).toHaveCount(7);

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  const currencyDialog = page.getByRole("dialog", { name: "Edit Item" });
  await expect(currencyDialog.getByLabel("ISO currency code")).toHaveValue("SGD");
  await expect(currencyDialog.getByLabel("Currency denomination")).toHaveValue("1");
  await expect(currencyDialog.getByText("Total: SGD 3.00", { exact: true })).toBeVisible();
  await currencyDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(currencyDialog).toBeHidden();

  const firstChecks = page.getByRole("button", { name: "First Check" });
  while (await firstChecks.count()) {
    const remaining = await firstChecks.count();
    await firstChecks.first().click();
    await expect(firstChecks).toHaveCount(remaining - 1);
  }
  const secondChecks = page.getByRole("button", { name: "Second Check" });
  await expect(secondChecks).toHaveCount(7);
  while (await secondChecks.count()) {
    const remaining = await secondChecks.count();
    await secondChecks.first().click();
    await expect(secondChecks).toHaveCount(remaining - 1);
  }

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  await page.getByRole("dialog", { name: "Edit Item" }).getByLabel("Quantity").fill("4");
  await page.getByRole("dialog", { name: "Edit Item" }).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: "First Check" })).toHaveCount(1);
  await expect(page.getByText("SGD 105.00", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  await page.getByRole("dialog", { name: "Edit Item" }).getByLabel("Quantity").fill("3");
  await page.getByRole("dialog", { name: "Edit Item" }).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("SGD 104.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "First Check" }).click();
  await expect(page.getByRole("button", { name: "Second Check" })).toHaveCount(1);
  await page.getByRole("button", { name: "Second Check" }).click();

  const finalise = page.getByRole("button", { name: "Confirm & Complete" });
  await expect(finalise).toBeEnabled();
  await finalise.click();
  await expect(page.getByText(/Property Record Completed/)).toBeVisible();

  await page.getByRole("link", { name: "Start collection claim" }).click();
  await expect(page).toHaveURL(/\/cases\/CT3A-20260721-DEMO\/claim$/);
  await expect(page.getByRole("radio", { name: /No lost report/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("textbox", { name: "Claimant name", exact: true }).fill("Synthetic Passenger");
  await page.getByRole("textbox", { name: "Contact details", exact: true }).fill("synthetic@example.test");
  await page.getByRole("textbox", { name: /Masked identifier/, exact: false }).fill("****123A");
  await page.getByText("Identity-bearing item matches claimant", { exact: true }).click();
  await page.getByText("Undisclosed contents described", { exact: true }).click();
  await page.getByLabel("Staff-only verification note").fill("Synthetic ID matched and claimant named the hidden notebook.");
  await page.getByRole("button", { name: "Create claim record" }).click();
  await expect(page.getByRole("heading", { name: "Verification pending" })).toBeVisible();
  await page.getByLabel("Decision reason").fill("Identity and undisclosed content independently matched.");
  await page.getByText("Staff attests claimant acknowledgement", { exact: true }).click();
  await page.getByRole("button", { name: "Approve and record handover" }).click();
  await expect(page.getByText("Handover complete", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Collected" })).toBeVisible();

  const completedCaseSearch = await page.evaluate(async () => {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "", mode: "text" }),
    });
    return response.json();
  });
  expect(completedCaseSearch.results).toHaveLength(13);
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
  expect(exports.json.manifest).toHaveLength(13);
  expect(exports.json.manifest.find((item) => item.id === "sgd-1-coins").regions).toHaveLength(3);
  expect(exports.csv).toContain("Photo Regions");
  expect(exports.json.currencySummary).toEqual([
    { currencyCode: "MYR", total: "50.4" },
    { currencyCode: "SGD", total: "104" },
  ]);
  expect(exports.json.manifest.every((item) => ["demo-evidence-1", "staff-added"].includes(item.evidenceId))).toBe(true);
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

  await page.goto("/cases/CT3A-20260721-DEMO");
  await expect(page.getByText(/ITEM LIST EXPORTED/).first()).toBeVisible();
  await expect(page.getByText(/ITEM COLLECTED/).first()).toBeVisible();
});
