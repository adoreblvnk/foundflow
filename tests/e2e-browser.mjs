import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
const evidencePath = process.env.E2E_EVIDENCE_PATH;
const invalidEvidencePath = process.env.E2E_INVALID_EVIDENCE_PATH;

if (!username || !password || !evidencePath || !invalidEvidencePath) {
  throw new Error("E2E_USERNAME, E2E_PASSWORD, E2E_EVIDENCE_PATH, and E2E_INVALID_EVIDENCE_PATH are required");
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
  const postUploadBody = await page.locator("body").innerText();
  const postUploadCase = await page.evaluate(async (id) => {
    const response = await fetch(`/api/cases/${id}`, { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  }, caseId);
  assert.equal(postUploadCase.status, 200, `case refresh API failed: ${JSON.stringify(postUploadCase.body)}`);
  assert.equal(postUploadCase.body.uploads.length, 1, "uploaded evidence should be persisted");
  assert.match(postUploadBody, /EVIDENCE GALLERY \(1\)/, "uploaded evidence should refresh in the UI");

  await page.getByRole("button", { name: "Live AI Analysis" }).click();
  await page.getByText(/AI analysis complete/).waitFor({ timeout: 300_000 });
  const postAnalysisBody = await page.locator("body").innerText();
  const recordMatch = postAnalysisBody.match(/Manifest Workspace\s+(\d+)\s+records/);
  assert.ok(recordMatch, "record count should be visible");
  assert.ok(Number(recordMatch[1]) > 1, "live image analysis should identify at least one item beyond the root");

  await page.getByRole("button", { name: "+ Add Item Manually" }).click();
  const addModal = page.getByRole("heading", { name: /Add New Manifest Record/ }).locator("..");
  await addModal.locator('input[type="text"]').first().fill("Unclear inspection token");
  await addModal.locator("select").last().selectOption("review");
  await addModal.getByRole("button", { name: "Add Item", exact: true }).click();
  await page.getByText(/Added item "Unclear inspection token"/).waitFor();
  await expectDisabled(page.getByRole("button", { name: "Approve and Finalise" }));

  while (await page.getByRole("button", { name: "Confirm Entry" }).count()) {
    await page.getByRole("button", { name: "Confirm Entry" }).first().click();
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
  assert.equal(await page.getByRole("button", { name: "Live AI Analysis" }).count(), 0);

  const jsonExport = await page.evaluate(async (id) => {
    const response = await fetch(`/api/cases/${id}/export/json`, { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  }, caseId);
  assert.equal(jsonExport.status, 200);
  assert.equal(jsonExport.body.caseId, caseId);
  assert.ok(jsonExport.body.manifest.length > 1);
  assert.ok(jsonExport.body.manifest.every((item) => ["ai", "staff", "system"].includes(item.source)));

  const csvExport = await page.evaluate(async (id) => {
    const response = await fetch(`/api/cases/${id}/export/csv`, { cache: "no-store" });
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body: await response.text(),
    };
  }, caseId);
  assert.equal(csvExport.status, 200);
  assert.match(csvExport.contentType, /text\/csv/);
  assert.match(csvExport.body, /Orange luggage tag/i);

  const auditText = await page.locator("body").innerText();
  for (const event of ["EVIDENCE UPLOADED", "AI ANALYSIS TRIGGERED", "ITEM ADDED", "ITEM CONFIRMED", "CASE FINALISED"]) {
    assert.match(auditText, new RegExp(event));
  }

  console.log(JSON.stringify({ caseId, records: Number(recordMatch[1]), status: "passed" }));
} finally {
  await browser.close();
}

async function expectDisabled(locator) {
  assert.equal(await locator.isDisabled(), true, "finalisation should be disabled while review items remain");
}
