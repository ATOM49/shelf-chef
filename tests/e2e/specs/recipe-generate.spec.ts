import { test, expect } from "@playwright/test";
import { mockLlmRoutes } from "../helpers/mocks.js";
import { waitForAppReady, resetUserState } from "../helpers/state.js";

test.describe("Recipe book – generate recipes", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockLlmRoutes(context);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await resetUserState(page);
  });

  test("opens recipe book and creates a custom recipe from inventory", async ({ page }) => {
    // First stock some items so there is inventory to work with
    await page.getByRole("button", { name: "Stock items" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Describe what you want to stock").fill("eggs, butter, rice");
    await page.getByRole("button", { name: "Review stock suggestions" }).click();
    await expect(page.getByRole("heading", { name: "Review AI-organized stock" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Add .* item.* to inventory/ }).click();

    // Open recipe book
    await page.getByRole("button", { name: "Recipe book" }).click();
    await expect(page.getByRole("heading", { name: "Recipe book" })).toBeVisible({ timeout: 5_000 });

    // Switch to the "Create recipe" tab
    await page.getByRole("button", { name: "Create recipe" }).click();

    // Fill in a dish name
    await page.getByLabel("Dish name").fill("Egg Fried Rice");

    // Select all visible inventory items
    await page.getByRole("button", { name: "Select visible" }).click();

    // Submit – mock intercepts /api/recipes/generate/custom
    await page.getByRole("button", { name: "Save recipe to book" }).click();

    // After creation, the detail view should show the custom recipe title
    await expect(page.getByRole("heading", { name: "Custom Egg Fried Rice" })).toBeVisible({
      timeout: 10_000,
    });
  });
});
