import { test, expect } from "@playwright/test";
import { mockLlmRoutes } from "../helpers/mocks.js";
import { waitForAppReady, resetUserState } from "../helpers/state.js";

test.describe("Stocking – preset flow", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockLlmRoutes(context);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await resetUserState(page);
  });

  test("opens the stocking dialog and uses a preset", async ({ page }) => {
    // Open the stocking dialog
    await page.getByRole("button", { name: "Stock items" }).click();

    // The stocking dialog should be visible with the preset buttons
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Start from a kitchen preset")).toBeVisible();

    // Click the "Scarce" preset
    await page.getByRole("button", { name: "Generate from preset" }).first().click();

    // The mock fires immediately – we should go straight to the preview step
    await expect(page.getByRole("heading", { name: "Review AI-organized stock" })).toBeVisible({
      timeout: 10_000,
    });

    // The fixture contains items like "Butter", "Milk", etc.
    await expect(page.getByText("Milk")).toBeVisible();

    // Confirm stocking
    await page.getByRole("button", { name: /add to inventory/i }).click();

    // Dialog closes and shelves should be populated
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
