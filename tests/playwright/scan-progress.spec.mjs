import { test, expect } from "playwright/test";

const dataDir = "/tmp/foundflow-playwright-cli";

async function seedAndLogin(page) {
  process.env.DATA_DIR = dataDir;
  const { seedDemoCase, closeDb } = await import("../../src/lib/db.ts");
  const demoCase = await seedDemoCase();
  closeDb();
  await page.goto(`/cases/${demoCase.id}`);
  if (page.url().includes("/login")) {
    await page.getByLabel("Staff Identifier").fill("playwright-officer");
    await page.getByLabel("Security Password").fill("foundflow-playwright-password");
    await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
    await expect(page).toHaveURL(/\/cases$/);
    await page.goto(`/cases/${demoCase.id}`);
  }
  return demoCase;
}

async function installScanStream(page, events, delay = 120) {
  await page.addInitScript(({ scanEvents, eventDelay }) => {
    const nativeFetch = window.fetch.bind(window);
    window.__scanEvents = [];
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (init?.method === "POST" && /\/api\/cases\/[^/]+\/scan$/.test(url)) {
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            scanEvents.forEach((event, index) => {
              setTimeout(() => {
                window.__scanEvents.push(event);
                controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
                if (index === scanEvents.length - 1) controller.close();
              }, eventDelay * (index + 1));
            });
          },
        });
        return new Response(body, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
      }
      return nativeFetch(input, init);
    };
  }, { scanEvents: events, eventDelay: delay });
}

const successEvents = [
  { type: "started", progress: 5, label: "Starting photo scan", photoCount: 1 },
  { type: "photos_loaded", progress: 20, label: "Item photos loaded", photoCount: 1 },
  { type: "analysis_stage_complete", progress: 55, label: "One AI analysis pass complete", photoCount: 1 },
  { type: "analysis_complete", progress: 75, label: "Photo analysis complete", photoCount: 1 },
  { type: "saving", progress: 90, label: "Saving the linked item draft", photoCount: 1 },
  { type: "complete", progress: 100, label: "Photo scan complete", photoCount: 1, itemCount: 11 },
];

test("scan stream requires an authenticated staff session", async ({ request }) => {
  const response = await request.post("/api/cases/not-a-case/scan");
  expect(response.status()).toBe(401);
});

test("case workspace renders truthful monotonic streamed scan progress and refreshes", async ({ page }) => {
  await installScanStream(page, successEvents);
  await seedAndLogin(page);

  const scanButton = page.getByRole("button", { name: "Scan Item Photos" });
  await scanButton.click();
  await expect(page.getByRole("button", { name: "Scanning..." })).toBeDisabled();
  const progress = page.getByRole("progressbar", { name: "Photo scan progress" });
  await expect(progress).toHaveAttribute("value", "5");
  await expect(progress).toHaveAttribute("value", "20");
  await expect(progress).toHaveAttribute("value", "55");
  await expect(progress).toHaveAttribute("value", "75");
  await expect(progress).toHaveAttribute("value", "90");
  await expect(progress).toHaveAttribute("value", "100");
  await expect(page.getByRole("status").filter({ hasText: "Scan complete - 11 items detected" })).toBeVisible();
  await expect(scanButton).toBeEnabled();

  const received = await page.evaluate(() => window.__scanEvents);
  expect(received.map((event) => event.type)).toEqual(successEvents.map((event) => event.type));
  expect(received.every((event, index) => index === 0 || event.progress > received[index - 1].progress)).toBe(true);
});

test("scan stream reports a recoverable provider failure without fake progress or layout overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installScanStream(page, [
    ...successEvents.slice(0, 2),
    { type: "error", progress: 100, label: "Photo scan could not be completed", photoCount: 1, error: "AI scan failed with all configured providers. Continue manually or try again." },
  ]);
  await seedAndLogin(page);

  await page.getByRole("button", { name: "Scan Item Photos" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Continue manually or try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan Item Photos" })).toBeEnabled();
  const progressBox = await page.getByRole("progressbar", { name: "Photo scan progress" }).boundingBox();
  expect(progressBox).toBeTruthy();
  expect(progressBox.x + progressBox.width).toBeLessThanOrEqual(360);
});
