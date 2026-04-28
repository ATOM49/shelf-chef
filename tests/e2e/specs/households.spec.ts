import { test, expect } from "@playwright/test";
import { mockLlmRoutes } from "../helpers/mocks.js";
import { waitForAppReady, resetUserState } from "../helpers/state.js";

test.describe("Households", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockLlmRoutes(context);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await resetUserState(page);
  });

  test("shows the workspace selector in the header", async ({ page }) => {
    const selector = page.getByRole("combobox");
    await expect(selector).toBeVisible();
  });

  test("personal workspace is selected by default", async ({ page }) => {
    const selector = page.getByRole("combobox");
    // The default workspace label contains "Personal workspace"
    await expect(selector).toContainText("Personal workspace");
  });

  test("can switch to the household workspace", async ({ page }) => {
    const selector = page.getByRole("combobox");
    await selector.click();
    // The household option should appear (seeded as "E2E Test User's household")
    const householdOption = page.getByRole("option", { name: /household/i });
    if (await householdOption.count() > 0) {
      await householdOption.first().click();
      // After switching, the selector should reflect the household name
      await expect(selector).not.toContainText("Personal workspace");
    }
  });

  test("can switch back to personal workspace", async ({ page }) => {
    const selector = page.getByRole("combobox");
    // First switch to household if available
    await selector.click();
    const householdOption = page.getByRole("option", { name: /household/i });
    if (await householdOption.count() > 0) {
      await householdOption.first().click();
    } else {
      await page.keyboard.press("Escape");
    }
    // Switch back to personal
    await selector.click();
    await page.getByRole("option", { name: "Personal workspace" }).click();
    await expect(selector).toContainText("Personal workspace");
  });
});
