import { expect, test } from "playwright/test";

test.afterEach(async ({ page }, testInfo) => {
  if (process.env.PLAYWRIGHT_DEMO_RECORDING === "1") {
    const video = page.video();
    expect(video, "headed demo video recorder").not.toBeNull();
    await page.close();
    await video.saveAs(testInfo.outputPath("demo.webm"));
  }
});

test("photo-linked demo completes the found-item workflow", async ({ page }) => {
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED" && new URL(request.url()).origin === new URL(page.url() || "http://127.0.0.1").origin) {
      failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`);
    }
  });

  const seedResponse = await page.request.post("/api/testing/seed-demo");
  expect(seedResponse.ok()).toBe(true);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Lost & found, clearly accounted for." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Manage Cases/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Search Records/ })).toBeVisible();
  await expect(page.getByText(/Photograph\. Scan\. Verify\./)).toHaveCount(0);
  await expect(page.getByText("Staff Operations", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Kiosk Mode/)).toHaveCount(0);

  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/search");
  const searchCard = await page.locator(".search-filter-card").boundingBox();
  const searchControls = await page.locator(".search-filter-card input, .search-filter-card select").all();
  for (const control of searchControls) {
    const box = await control.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((searchCard?.x ?? 0) + (searchCard?.width ?? 0));
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/kiosk");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

  await page.goto("/cases");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Staff Identifier").fill("playwright-officer");
  await page.getByLabel("Security Password").fill("foundflow-playwright-password");
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await expect(page).toHaveURL(/\/cases$/);

  await expect(page.getByRole("heading", { name: "Cases", exact: true })).toBeVisible();
  await expect(page.getByText("Staff Operations", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Step-by-Step Intake Process", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Load Demo|Reset Demo/ })).toHaveCount(0);

  await page.goto("/cases/new/intake");
  await expect(page).toHaveURL(/\/cases\/new$/);
  await expect(page.getByRole("heading", { name: "Step-by-step instructions" })).toBeVisible();
  await page.getByRole("button", { name: "Acknowledge & Continue" }).click();
  await expect(page).toHaveURL(/\/cases\/new$/);
  await page.getByText("I understand and will follow these instructions.", { exact: true }).click();
  await page.getByRole("button", { name: "Acknowledge & Continue" }).click();
  await expect(page).toHaveURL(/\/cases\/new\/intake$/);
  await expect(page.getByRole("heading", { name: "Where and when found" })).toBeVisible();
  await page.getByLabel(/Terminal/).selectOption("T3");
  await page.getByLabel(/Area/).selectOption("Transit Area");
  await page.getByLabel("Specific location").fill("Beside Gate B5 charging station");
  await page.getByLabel(/Found date and time/).fill("2026-08-04T10:30");
  await page.getByLabel(/Outer item/).fill("Test umbrella");
  await page.getByLabel("Found or handed in by").fill("Synthetic cleaner");
  await page.getByLabel("Current storage location").fill("L&F Cabinet A3");
  await page.getByLabel("Staff notes").fill("Synthetic automated walkthrough record.");
  await page.getByRole("button", { name: "Create Case" }).click();
  await expect(page).toHaveURL(/\/cases\/(?!new)[^/]+$/);
  const disposableCaseId = page.url().split("/").pop();
  await expect(page.getByText("INSTRUCTIONS ACKNOWLEDGED", { exact: true })).toBeVisible();
  await page.locator("#file").setInputFiles(`${process.cwd()}/public/demo/found-item-evidence.webp`);
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText("Item Photos (1)", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Delete photo found-item-evidence\.webp/ }).click();
  await expect(page.getByText("Item Photos (0)", { exact: true })).toBeVisible();
  await expect(page.getByText("PHOTO DELETED", { exact: true })).toBeVisible();

  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "Pending Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready to Complete" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirmed Cases" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collected" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible();
  await page.getByRole("button", { name: `Archive case ${disposableCaseId}` }).click();
  await expect(page.getByRole("region", { name: "Archived" }).locator(`a[href="/cases/${disposableCaseId}"]`)).toBeVisible();
  await page.getByRole("button", { name: `Restore case ${disposableCaseId}` }).click();
  await expect(page.getByRole("region", { name: "Pending Review" }).locator(`a[href="/cases/${disposableCaseId}"]`)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Delete case ${disposableCaseId}` }).click();
  await expect(page.locator(`a[href="/cases/${disposableCaseId}"]`)).toHaveCount(0);
  await page.locator('a[href="/cases/CT3A-20260721-DEMO"]').first().click();
  await expect(page).toHaveURL(/\/cases\/CT3A-20260721-DEMO$/);
  await expect(page.getByText("Item Photos (1)", { exact: true })).toBeVisible();
  await expect(page.getByText("11 records", { exact: true })).toBeVisible();
  await expect(page.getByText(/second check/i)).toHaveCount(0);
  await expect(page.getByText("Demo case created from a staged synthetic found-item set", { exact: true })).toHaveCount(0);
  await expect(page.getByText("SGD 104.00", { exact: true })).toBeVisible();
  await expect(page.getByText("MYR 50.40", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(5);
  await expect(page.getByRole("region", { name: "Match records to the photo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Match records to the photo" }).getByText("15/15 listed objects boxed", { exact: true })).toBeVisible();
  await expect(page.locator(".photo-region")).toHaveCount(15);
  const verifierBox = await page.getByRole("region", { name: "Match records to the photo" }).boundingBox();
  const capturePanelBox = await page.locator(".capture-panel").boundingBox();
  const reviewPanelBox = await page.locator(".review-panel").boundingBox();
  expect(verifierBox?.x).toBeGreaterThanOrEqual(reviewPanelBox?.x ?? Number.MAX_SAFE_INTEGER);
  expect(verifierBox?.width).toBeGreaterThan(capturePanelBox?.width ?? Number.MAX_SAFE_INTEGER);
  const scanButton = page.locator(".capture-panel").getByRole("button", { name: "Scan Item Photos" });
  await expect(scanButton).toBeVisible();
  await scanButton.click();
  await expect(page.getByRole("progressbar", { name: "Photo scan progress" })).toHaveAttribute("value", "100");
  await expect(page.getByRole("status").filter({ hasText: "Scan complete - 10 items detected" })).toBeVisible();
  await expect(page.locator(".review-panel").getByRole("button", { name: "Scan Item Photos" })).toHaveCount(0);
  const photosBox = await page.locator(".item-photos-section").boundingBox();
  const scanBox = await scanButton.boundingBox();
  const uploadBox = await page.locator(".item-photo-upload").boundingBox();
  expect(scanBox?.y).toBeGreaterThan((photosBox?.y ?? 0) + (photosBox?.height ?? Number.MAX_SAFE_INTEGER));
  expect((scanBox?.y ?? Number.MAX_SAFE_INTEGER) + (scanBox?.height ?? 0)).toBeLessThan(uploadBox?.y ?? 0);
  await expect(page.getByRole("region", { name: "Owner context and handling advice" })).toHaveCount(0);

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
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(5);

  await expect(page.getByRole("button", { name: /Singapore 1-dollar specimen coins, region/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Show Singapore 1-dollar specimen coins on source photo" }).click();
  await page.getByRole("button", { name: "Singapore 1-dollar specimen coins, region 1" }).click();
  await page.getByLabel("Assign box to").selectOption("sgd-050-coins");
  await expect(page.getByRole("button", { name: /Singapore 50-cent specimen coins, region/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Singapore 50-cent specimen coins, region 3" }).click();
  await page.getByLabel("Assign box to").selectOption("sgd-1-coins");
  await expect(page.getByRole("button", { name: /Singapore 1-dollar specimen coins, region/ })).toHaveCount(3);

  const chooseImage = page.getByRole("button", { name: /Choose/ });
  const uploadPhoto = page.getByRole("button", { name: "Upload", exact: true });
  await expect(chooseImage).toBeVisible();
  await expect(uploadPhoto).toBeDisabled();
  const photoInput = page.locator("#file");
  const photoContext = page.locator("#containerContext");
  await expect(photoContext).toHaveValue("loose-item");
  await expect(photoContext.getByRole("option", { name: "Loose / standalone item (no container)" })).toHaveCount(1);
  await photoInput.setInputFiles("public/demo/found-item-evidence.webp");
  await expect(page.getByText("found-item-evidence.webp", { exact: true })).toBeVisible();
  await expect(uploadPhoto).toBeEnabled();
  await photoInput.setInputFiles([]);
  await expect(page.getByText("found-item-evidence.webp", { exact: true })).toHaveCount(0);
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

  const photo = page.locator('img[alt="staged-found-item.webp"]');
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
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(7);

  await page.getByRole("button", { name: "+ Add Item", exact: true }).click();
  const unknownCoinDialog = page.getByRole("dialog", { name: "Add Item" });
  await unknownCoinDialog.getByLabel("Item Label").fill("coin");
  await unknownCoinDialog.getByRole("button", { name: "Add Item" }).click();
  const unknownCoin = page.locator("article").filter({ has: page.getByText("coin", { exact: true }) });
  await unknownCoin.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText(/requires a valid ISO 4217 currency code/)).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await unknownCoin.getByRole("button", { name: "Delete coin" }).click();
  await expect(page.getByText("13 records", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  const currencyDialog = page.getByRole("dialog", { name: "Edit Item" });
  await expect(currencyDialog.getByLabel("ISO currency code")).toHaveValue("SGD");
  await expect(currencyDialog.getByLabel("Currency denomination")).toHaveValue("1");
  await expect(currencyDialog.getByText("Total: SGD 3.00", { exact: true })).toBeVisible();
  await currencyDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(currencyDialog).toBeHidden();

  const confirmations = page.getByRole("button", { name: "Confirm", exact: true });
  while (await confirmations.count()) {
    const remaining = await confirmations.count();
    await confirmations.first().click();
    await expect(confirmations).toHaveCount(remaining - 1);
  }

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  await page.getByRole("dialog", { name: "Edit Item" }).getByLabel("Quantity").fill("4");
  await page.getByRole("dialog", { name: "Edit Item" }).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(1);
  await expect(page.getByText("SGD 105.00", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Singapore 1-dollar specimen coins" }).click();
  await page.getByRole("dialog", { name: "Edit Item" }).getByLabel("Quantity").fill("3");
  await page.getByRole("dialog", { name: "Edit Item" }).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("SGD 104.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();

  await page.goto("/cases/CT3A-20260721-DEMO/scan");
  await expect(page.getByRole("heading", { name: "Scan Item Photos" })).toBeVisible();
  await page.goto("/cases/CT3A-20260721-DEMO/review");
  await expect(page.getByRole("heading", { name: "Review Items" })).toBeVisible();
  await page.goto("/cases/CT3A-20260721-DEMO/finalise");
  await expect(page.getByRole("heading", { name: "Complete & Export" })).toBeVisible();
  await page.goto("/cases/CT3A-20260721-DEMO");

  const finalise = page.getByRole("button", { name: "Confirm & Complete" });
  await expect(finalise).toBeEnabled();
  await finalise.click();
  await expect(page.getByText(/Item Record Completed/)).toBeVisible();

  await page.goto("/search");
  await page.getByLabel("Location").selectOption("T3 Arrival");
  await page.getByLabel("Location").selectOption("");
  await page.getByLabel("Item Type").selectOption("books");
  await page.getByLabel("Date From").fill("2026-07-21");
  await page.getByLabel("Date To").fill("2026-07-21");
  await page.getByLabel("Found By").fill("Demo staff");
  await page.getByLabel("Description (optional)").fill("kraft notebook");
  await page.getByRole("button", { name: /Search/ }).click();
  await expect(page.getByText("1 result found", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Plain kraft notebook/ }).click();
  await expect(page).toHaveURL(/\/cases\/CT3A-20260721-DEMO$/);

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

  await page.goto("/cases/CT3A-20260721-DEMO");
  await expect(page.getByRole("link", { name: /Download (?:JSON|CSV)/ })).toHaveCount(0);
  await expect(page.getByText(/ITEM COLLECTED/).first()).toBeVisible();
  expect(pageErrors, "uncaught page errors").toEqual([]);
  expect(failedRequests, "failed same-origin requests").toEqual([]);
});
