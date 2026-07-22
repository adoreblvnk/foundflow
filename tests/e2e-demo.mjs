import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = process.cwd();
const dataDir = await mkdtemp(path.join(os.tmpdir(), "foundflow-demo-e2e-"));
const port = await getFreePort();
const baseURL = `http://127.0.0.1:${port}`;
const username = "demo-officer";
const password = "foundflow-demo-password";
const server = spawn(
  process.execPath,
  [path.join(projectRoot, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      AUTH_SECRET: "foundflow-demo-e2e-secret-0123456789abcdef",
      LOGIN_USERNAME: username,
      LOGIN_PASSWORD: password,
      DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
);

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

let browser;
try {
  await waitForServer(`${baseURL}/`);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);

  await page.goto(`${baseURL}/cases`);
  assert.equal(new URL(page.url()).pathname, "/login");
  await page.getByLabel("Staff Identifier").fill(username);
  await page.getByLabel("Security Password").fill(password);
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await page.waitForURL(`${baseURL}/cases`);

  await page.getByRole("button", { name: /Load Demo Case/ }).click();
  await page.getByText("FF-0241", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Open Case File →" }).click();
  await page.waitForURL(`${baseURL}/cases/FF-0241`);

  await page.getByText("Evidence Gallery (1)", { exact: true }).waitFor();
  const evidenceImage = page.locator('img[alt="staged-found-property.webp"]');
  await evidenceImage.waitFor();
  assert.ok(await evidenceImage.evaluate((image) => image.complete && image.naturalWidth > 0));
  await page.getByText("9 records", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Confirm Entry" }).count(), 3);
  assert.equal(await page.getByRole("button", { name: "Approve and Finalise" }).isDisabled(), true);

  while (await page.getByRole("button", { name: "Confirm Entry" }).count()) {
    await page.getByRole("button", { name: "Confirm Entry" }).first().click();
    await page.getByText(/Item confirmed/).waitFor();
  }

  const finalise = page.getByRole("button", { name: "Approve and Finalise" });
  assert.equal(await finalise.isDisabled(), false);
  await finalise.click();
  await page.getByText(/Case intake finalised and locked successfully/).waitFor();
  await page.getByText(/Custody Case Finalised & Approved/).waitFor();

  const exported = await page.evaluate(async () => {
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
  assert.equal(exported.jsonStatus, 200);
  assert.equal(exported.csvStatus, 200);
  assert.equal(exported.json.caseId, "FF-0241");
  assert.equal(exported.json.manifest.length, 9);
  assert.ok(exported.json.manifest.every((item) => item.evidenceId === "demo-evidence-1"));
  assert.match(exported.csv, /SAMPLE-0241/);

  const body = await page.locator("body").innerText();
  for (const event of ["EVIDENCE UPLOADED", "DEMO SEEDED", "ITEM CONFIRMED", "CASE FINALISED"]) {
    assert.match(body, new RegExp(event));
  }

  console.log(JSON.stringify({ caseId: "FF-0241", evidenceFiles: 1, records: 9, reviewsResolved: 3, exports: ["json", "csv"], status: "passed" }));
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(dataDir, { recursive: true, force: true });
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`FoundFlow server exited early with code ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the bounded deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
