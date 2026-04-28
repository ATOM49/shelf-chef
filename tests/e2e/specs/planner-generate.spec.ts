import { test, expect } from "@playwright/test";
import { mockLlmRoutes } from "../helpers/mocks.js";
import { waitForAppReady, resetUserState } from "../helpers/state.js";

test.describe("Planner – generate", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockLlmRoutes(context);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await resetUserState(page);
  });

  test("clicking Create plan triggers generation and renders the weekly plan", async ({ page }) => {
    // Click the "Create plan" button
    await page.getByRole("button", { name: "Create plan" }).click();

    // The mock responds instantly, so the plan should appear quickly
    // The planner fixture returns "Vegetable Stir Fry" for Monday dinner
    await expect(page.getByText("Vegetable Stir Fry")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Scrambled Eggs")).toBeVisible();
  });

  test("a generated plan can be cleared", async ({ page }) => {
    // Generate the plan
    await page.getByRole("button", { name: "Create plan" }).click();
    await expect(page.getByText("Vegetable Stir Fry")).toBeVisible({ timeout: 10_000 });

    // Clear the plan
    await page.getByRole("button", { name: "Clear plan" }).click();

    // Confirm in the alert dialog
    const confirmButton = page.getByRole("button", { name: /clear/i }).last();
    await confirmButton.click();

    // Plan content should be gone
    await expect(page.getByText("Vegetable Stir Fry")).not.toBeVisible();
  });
});
