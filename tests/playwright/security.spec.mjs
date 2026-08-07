import { test, expect } from "playwright/test";

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Staff Identifier").fill("playwright-officer");
  await page.getByLabel("Security Password").fill("foundflow-playwright-password");
  await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
  await expect(page).toHaveURL(/\/cases$/);
}

test("security headers protect pages and suppress framework disclosure", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("search and item-photo APIs remain access-controlled when login is re-enabled", async ({ page }) => {
  const unauthenticatedSearch = await page.request.post("/api/search", { data: { query: "bag" } });
  expect(unauthenticatedSearch.status()).toBe(401);

  const seed = await page.request.post("/api/testing/seed-demo");
  expect(seed.ok()).toBe(true);
  const demoCase = await seed.json();
  await login(page);

  const invalidSearch = await page.evaluate(async () => {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "x", unexpected: "field" }),
    });
    return { status: response.status, cache: response.headers.get("cache-control") };
  });
  expect(invalidSearch.status).toBe(400);
  expect(invalidSearch.cache).toContain("no-store");

  const oversizedSearch = await page.evaluate(async () => {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "x".repeat(17_000) }),
    });
    return response.status;
  });
  expect(oversizedSearch).toBe(413);

  const itemPhoto = await page.evaluate(async (uploadId) => {
    const response = await fetch(`/api/uploads/${uploadId}`);
    return {
      status: response.status,
      cache: response.headers.get("cache-control"),
      contentTypeOptions: response.headers.get("x-content-type-options"),
    };
  }, demoCase.uploads[0].id);
  expect(itemPhoto.status).toBe(200);
  expect(itemPhoto.cache).toContain("no-store");
  expect(itemPhoto.contentTypeOptions).toBe("nosniff");
});
