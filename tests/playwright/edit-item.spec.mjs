import { expect, test } from "playwright/test";

test("changing an AI item's source does not retain boxes from the old photo", async ({ page }) => {
  const seedResponse = await page.request.post("/api/testing/seed-demo");
  expect(seedResponse.ok()).toBe(true);
  const demoCase = await seedResponse.json();
  const item = demoCase.manifest.find((candidate) => candidate.id !== "outer-item-root" && candidate.regions?.length);
  expect(item).toBeTruthy();

  await page.goto(`/cases/${demoCase.id}`);
  if (page.url().includes("/login")) {
    await page.getByLabel("Staff Identifier").fill("playwright-officer");
    await page.getByLabel("Security Password").fill("foundflow-playwright-password");
    await page.getByRole("button", { name: "Sign in to FoundFlow" }).click();
    await expect(page).toHaveURL(/\/cases/);
    await page.goto(`/cases/${demoCase.id}`);
  }

  await page.getByRole("button", { name: `Edit ${item.label}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Item" });
  await dialog.getByLabel("Source Photo").selectOption("staff-added");
  const statusSelect = dialog.getByLabel("Status");
  await expect(statusSelect).toBeDisabled();
  await expect(statusSelect).toHaveValue("review");
  await expect(dialog.getByText("A changed source must be saved as Needs Review until its photo regions are checked.")).toBeVisible();
  await statusSelect.evaluate((element) => { element.disabled = false; });
  await statusSelect.selectOption("confirmed");
  await dialog.getByRole("button", { name: "Save Changes" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(`Updated item "${item.label}" successfully.`)).toBeVisible();

  const updatedCase = await page.evaluate(async (caseId) => {
    const response = await fetch(`/api/cases/${caseId}`);
    return response.json();
  }, demoCase.id);
  const updatedItem = updatedCase.manifest.find((candidate) => candidate.id === item.id);
  expect(updatedItem.evidenceId).toBe("staff-added");
  expect(updatedItem.regions).toEqual([]);
  expect(updatedItem.status).toBe("review");
});
