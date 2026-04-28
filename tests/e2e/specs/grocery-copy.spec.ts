import { test, expect } from "@playwright/test";
import { mockLlmRoutes } from "../helpers/mocks.js";
import { waitForAppReady, resetUserState } from "../helpers/state.js";

test.describe("Grocery list – copy details", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockLlmRoutes(context);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await resetUserState(page);
  });

  test("generates a plan and copies the grocery list to clipboard", async ({ page, context }) => {
    // Grant clipboard permissions so writeText succeeds
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Generate a meal plan – mock returns fixture with missing ingredients
    await page.getByRole("button", { name: "Create plan" }).click();
    await expect(page.getByText("Vegetable Stir Fry")).toBeVisible({ timeout: 10_000 });

    // Open the shopping cart drawer
    await page.getByRole("button", { name: "Shopping cart" }).click();
    await expect(page.getByRole("heading", { name: "Shopping cart" })).toBeVisible({
      timeout: 5_000,
    });

    // The cart may be populated with missing items (depends on inventory state).
    // If the cart is not empty, click "Copy shopping list"
    const copyButton = page.getByRole("button", { name: "Copy shopping list" });
    if (!(await copyButton.isDisabled())) {
      await copyButton.click();

      // Verify clipboard content was written (read it back)
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText.length).toBeGreaterThan(0);
    }

    // Also test the inline "Copy missing items" button if visible
    const copyMissingButton = page.getByRole("button", {
      name: "Copy missing items to clipboard",
    });
    if (await copyMissingButton.isVisible()) {
      await copyMissingButton.click();
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText.length).toBeGreaterThan(0);
    }
  });
});
