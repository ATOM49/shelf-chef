import { test, expect } from "@playwright/test";
import { mockLlmRoutes } from "../helpers/mocks.js";
import { waitForAppReady, resetUserState } from "../helpers/state.js";

test.describe("Recipe book – delete recipe", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockLlmRoutes(context);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await resetUserState(page);
  });

  test("creates and then deletes a user-saved recipe", async ({ page }) => {
    // Stock some items so inventory is non-empty for recipe generation
    await page.getByRole("button", { name: "Stock items" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Describe what you want to stock").fill("eggs, butter, rice");
    await page.getByRole("button", { name: "Review stock suggestions" }).click();
    await expect(page.getByRole("heading", { name: "Review AI-organized stock" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Add .* item.* to inventory/ }).click();

    // Open recipe book → Create recipe tab
    await page.getByRole("button", { name: "Recipe book" }).click();
    await expect(page.getByRole("heading", { name: "Recipe book" })).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Create recipe" }).click();
    await page.getByLabel("Dish name").fill("Egg Fried Rice");
    await page.getByRole("button", { name: "Select visible" }).click();
    await page.getByRole("button", { name: "Save recipe to book" }).click();

    // Confirm the recipe was created (we're now on the detail view)
    await expect(page.getByRole("heading", { name: "Custom Egg Fried Rice" })).toBeVisible({
      timeout: 10_000,
    });

    // Click "Delete recipe" button – only shown for user-saved recipes
    await page.getByRole("button", { name: "Delete recipe" }).click();

    // Confirm deletion in the popover
    const confirmDeleteButton = page.getByRole("button", { name: "Delete recipe" }).last();
    await confirmDeleteButton.click();

    // Should be back in browse view with no "Custom Egg Fried Rice" visible
    await expect(page.getByText("Custom Egg Fried Rice")).not.toBeVisible({ timeout: 5_000 });
  });
});
