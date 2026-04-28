import { test, expect } from "@playwright/test";
import { mockLlmRoutes } from "../helpers/mocks.js";
import { waitForAppReady, resetUserState } from "../helpers/state.js";

test.describe("Planner – customise", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockLlmRoutes(context);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await resetUserState(page);
  });

  test("opens the customise plan drawer and saves preferences", async ({ page }) => {
    // Click "Customise plan" button in the planner header
    await page.getByRole("button", { name: "Customise plan" }).click();

    // The planner sidebar / drawer should open
    await expect(page.getByText("Preferences")).toBeVisible({ timeout: 5_000 });

    // Fill in the preferences textarea
    const preferencesTextarea = page.getByPlaceholder(/high protein/i);
    await preferencesTextarea.clear();
    await preferencesTextarea.fill("High protein, vegetarian, avoid mushrooms");

    // Toggle the "Breakfast" meal type off (it should be on by default)
    const breakfastButton = page.getByRole("button", { name: "Breakfast" });
    if (await breakfastButton.getAttribute("data-variant") !== "outline") {
      await breakfastButton.click();
    }

    // Save the settings
    await page.getByRole("button", { name: "Save settings" }).click();

    // The drawer should close; planner header is still visible
    await expect(page.getByRole("button", { name: "Create plan" })).toBeVisible();
  });

  test("cancels without saving changes", async ({ page }) => {
    await page.getByRole("button", { name: "Customise plan" }).click();
    await expect(page.getByText("Preferences")).toBeVisible({ timeout: 5_000 });

    const preferencesTextarea = page.getByPlaceholder(/high protein/i);
    await preferencesTextarea.fill("This should not be saved");

    await page.getByRole("button", { name: "Cancel" }).click();

    // Drawer should close
    await expect(page.getByRole("button", { name: "Create plan" })).toBeVisible();
  });
});
