import { defineConfig } from "playwright/test";

const dataDir = "/tmp/foundflow-automated-demo";
process.env.DATA_DIR = dataDir;
process.env.PLAYWRIGHT_DEMO_RECORDING = "1";

export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: "demo.spec.mjs",
  globalSetup: "./tests/playwright/global-setup.mjs",
  globalTeardown: "./tests/playwright/global-teardown.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 12_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report/demo", open: "never" }]],
  outputDir: "test-results/automated-demo",
  use: {
    baseURL: "http://127.0.0.1:3104",
    channel: "chrome",
    headless: false,
    launchOptions: { slowMo: 180 },
    trace: "on",
    screenshot: "only-on-failure",
    video: { mode: "on", size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3104",
    url: "http://127.0.0.1:3104",
    timeout: 30_000,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    env: {
      ...process.env,
      AUTH_SECRET: "foundflow-demo-secret-0123456789abcdef",
      LOGIN_USERNAME: "playwright-officer",
      LOGIN_PASSWORD: "foundflow-playwright-password",
      PLAYWRIGHT_TEST_MODE: "1",
      DATA_DIR: dataDir,
    },
  },
});
