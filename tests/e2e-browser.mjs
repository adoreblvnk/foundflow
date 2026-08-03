import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
if (!username || !password) {
  throw new Error("E2E_USERNAME and E2E_PASSWORD are required");
}

const evidencePath = process.env.E2E_EVIDENCE_PATH ?? path.resolve("public/demo/found-item-evidence.webp");
if (!fs.existsSync(evidencePath)) {
  throw new Error(`E2E evidence fixture not found: ${evidencePath}`);
}

const temporaryInvalidDir = process.env.E2E_INVALID_EVIDENCE_PATH
  ? null
  : fs.mkdtempSync(path.join(os.tmpdir(), "foundflow-invalid-evidence-"));
const invalidEvidencePath = process.env.E2E_INVALID_EVIDENCE_PATH ?? path.join(temporaryInvalidDir, "invalid-image.png");
if (temporaryInvalidDir) {
  fs.writeFileSync(invalidEvidencePath, "This is deliberately not a valid image.");
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
});
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

try {
  await page.goto(`${baseURL}/cases`);
  assert.equal(new URL(page.url()).pathname, "/login");

  await page.getByLabel("Staff Identifier").fill("invalid-user");
  await page.getByLabel("Security Password").fill("invalid-password");
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await page.getByText("Invalid username or password", { exact: true }).waitFor();

  await page.getByLabel("Staff Identifier").fill(username);
  await page.getByLabel("Security Password").fill(password);
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await page.waitForURL(`${baseURL}/cases`);

  await page.getByRole("link", { name: "+ Create New Case" }).first().click();
  await page.getByLabel("Outer Custody Description *").fill("Black backpack");
  await page.getByLabel("Intake / Found Location *").fill("Changi Airport Terminal 3");
  await page.getByLabel("Optional Handover Notes").fill("Automated staged end-to-end evaluation");
  await page.getByRole("button", { name: "Initialize Case File" }).click();
  await page.waitForURL(/\/cases\/[0-9a-f-]+$/);
  const caseId = page.url().split("/").at(-1);
  assert.ok(caseId);
  await expectDisabled(page.getByRole("button", { name: "Approve and Finalise" }));

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(invalidEvidencePath);
  await page.getByRole("button", { name: "Upload & Associate" }).click();
  await page.getByText(/Security validation failed/).waitFor();
  assert.match(await page.locator("body").innerText(), /EVIDENCE GALLERY \(0\)/);

  await page.getByLabel("Container / Nesting Level").selectOption("bag-contents");
  await fileInput.setInputFiles(evidencePath);
  await page.getByRole("button", { name: "Upload & Associate" }).click();
  await page.getByText(/Evidence photo uploaded successfully/).waitFor();
  await page.getByText("Evidence Gallery (1)", { exact: true }).waitFor();
  const postUploadBody = await page.locator("body").innerText();
  const postUploadCase = await page.evaluate(async (id) => {
    const response = await fetch(`/api/cases/${id}`, { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  }, caseId);
  assert.equal(postUploadCase.status, 200, `case refresh API failed: ${JSON.stringify(postUploadCase.body)}`);
  assert.equal(postUploadCase.body.uploads.length, 1, "uploaded evidence should be persisted");
  assert.match(postUploadBody, /EVIDENCE GALLERY \(1\)/, "uploaded evidence should refresh in the UI");

  await page.getByRole("button", { name: "Scan Evidence" }).click();
  const analysisOutcome = page.getByText(/AI analysis complete|AI Analysis failed:/).first();
  await analysisOutcome.waitFor({ timeout: 300_000 });
  const analysisOutcomeText = await analysisOutcome.innerText();
  assert.doesNotMatch(analysisOutcomeText, /AI Analysis failed:/, analysisOutcomeText);
  const postAnalysisBody = await page.locator("body").innerText();
  const recordMatch = postAnalysisBody.match(/Manifest Workspace\s+(\d+)\s+records/);
  assert.ok(recordMatch, "record count should be visible");
  assert.ok(Number(recordMatch[1]) > 1, "live image analysis should identify at least one item beyond the root");

  const analyzedCase = await page.evaluate(async (id) => {
    const response = await fetch(`/api/cases/${id}`, { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  }, caseId);
  assert.equal(analyzedCase.status, 200);
  const analyzedLabels = analyzedCase.body.manifest.map((item) => item.label).join(" | ");
  for (const expected of [/pouch/i, /cable/i, /notebook|notepad/i, /tag/i, /currency|banknote|bank note|cash|dollar|ringgit/i]) {
    assert.match(analyzedLabels, expected, `representative evidence should produce ${expected}`);
  }
  assert.ok(
    analyzedCase.body.manifest.some((item) => item.parentId && item.parentId !== "outer-item-root"),
    "live analysis should preserve at least one nested container relationship"
  );
  const extractedText = analyzedCase.body.manifest.map((item) => item.ocrText ?? "").join(" | ");
  assert.match(extractedText, /SPECIMEN|SAMPLE-0241|ZX0000241|MYX0000241/i, "representative OCR should recover staged visible text");

  const currencyItems = analyzedCase.body.manifest.filter((item) => item.itemType === "currency");
  assert.ok(currencyItems.length >= 5, "live analysis should separate every currency and denomination group");
  for (const item of currencyItems) {
    assert.match(item.currencyCode ?? "", /^[A-Z]{3}$/);
    assert.ok(item.denomination > 0, `${item.label} should have an exact denomination`);
    assert.equal(Number(item.currencyTotal), Math.round(Number(item.denomination) * item.quantity * 100) / 100, `${item.label} should have an exact denomination × quantity total`);
  }
  const totals = currencyItems.reduce((summary, item) => {
    summary[item.currencyCode] = Math.round(((summary[item.currencyCode] ?? 0) + Number(item.currencyTotal)) * 100) / 100;
    return summary;
  }, {});
  assert.equal(totals.SGD, 104);
  assert.equal(totals.MYR, 50.4);
  assert.match(postAnalysisBody, /SGD 104\.00/);
  assert.match(postAnalysisBody, /MYR 50\.40/);

  await page.getByRole("button", { name: "+ Add Item Manually" }).click();
  const addModal = page.getByRole("heading", { name: /Add New Manifest Record/ }).locator("..");
  await addModal.getByLabel("Item Label").fill("Passport inspection token");
  await addModal.getByRole("button", { name: "Add Item", exact: true }).click();
  await page.getByText(/Added item "Passport inspection token"/).waitFor();
  const manuallyAddedCase = await page.evaluate(async (id) => {
    const response = await fetch(`/api/cases/${id}`, { cache: "no-store" });
    return response.json();
  }, caseId);
  const sensitiveManualItem = manuallyAddedCase.manifest.find((item) => item.label === "Passport inspection token");
  assert.equal(sensitiveManualItem?.status, "review");
  assert.match(sensitiveManualItem?.reviewReason ?? "", /Sensitive item details require staff confirmation/);
  await expectDisabled(page.getByRole("button", { name: "Approve and Finalise" }));

  while (await page.getByRole("button", { name: "Confirm" }).count()) {
    await page.getByRole("button", { name: "Confirm" }).first().click();
    await page.getByText(/Item confirmed/).waitFor();
  }

  const correction = page.getByLabel("Text-Command Fallback");
  await correction.fill("add orange luggage tag");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByText(/Voice Action: Added/).waitFor();
  assert.match(await page.locator("body").innerText(), /Orange luggage tag/i);

  const finalise = page.getByRole("button", { name: "Approve and Finalise" });
  assert.equal(await finalise.isDisabled(), false);
  await finalise.click();
  await page.getByText(/Case intake finalised and locked successfully/).waitFor();
  await page.getByText(/FINALI[ZS]ED/).waitFor();
  assert.equal(await page.getByRole("button", { name: "+ Add Item Manually" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Scan Evidence" }).count(), 0);

  await page.reload();
  const auditText = await page.locator("body").innerText();
  for (const event of ["EVIDENCE UPLOADED", "AI ANALYSIS TRIGGERED", "ITEM ADDED", "ITEM CONFIRMED", "CASE FINALISED"]) {
    assert.match(auditText, new RegExp(event));
  }

  console.log(JSON.stringify({ caseId, records: Number(recordMatch[1]), status: "passed" }));
} finally {
  await browser.close();
  if (temporaryInvalidDir) {
    fs.rmSync(temporaryInvalidDir, { recursive: true, force: true });
  }
}

async function expectDisabled(locator) {
  assert.equal(await locator.isDisabled(), true, "finalisation should be disabled while review items remain");
}
