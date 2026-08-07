import { defineConfig } from "playwright/test";

const dataDir = "/tmp/foundflow-playwright-cli";
process.env.DATA_DIR = dataDir;

export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: "*.spec.mjs",
  globalSetup: "./tests/playwright/global-setup.mjs",
  globalTeardown: "./tests/playwright/global-teardown.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3103",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3103",
    url: "http://127.0.0.1:3103",
    timeout: 30_000,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    env: {
      ...process.env,
      AUTH_SECRET: "foundflow-playwright-secret-0123456789abcdef",
      LOGIN_USERNAME: "playwright-officer",
      LOGIN_PASSWORD: "foundflow-playwright-password",
      PLAYWRIGHT_TEST_MODE: "1",
      PLAYWRIGHT_SCAN_FIXTURE: "1",
      DATA_DIR: dataDir,
    },
  },
});
