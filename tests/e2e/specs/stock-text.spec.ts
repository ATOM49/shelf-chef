import { test, expect } from "@playwright/test";
import { mockLlmRoutes } from "../helpers/mocks.js";
import { waitForAppReady, resetUserState } from "../helpers/state.js";

test.describe("Stocking – text input flow", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockLlmRoutes(context);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await resetUserState(page);
  });

  test("types a stock note, reviews AI suggestions and confirms", async ({ page }) => {
    // Open the stocking dialog
    await page.getByRole("button", { name: "Stock items" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Type into the free-text area
    await page.getByLabel("Describe what you want to stock").fill(
      "I bought some carrots, eggs, onions, tomatoes and garlic from the market.",
    );

    // Click the review button
    await page.getByRole("button", { name: "Review stock suggestions" }).click();

    // The mock fires immediately – review step should appear
    await expect(
      page.getByRole("heading", { name: "Review AI-organized stock" }),
    ).toBeVisible({ timeout: 10_000 });

    // The text-input fixture includes "Carrots"
    await expect(page.getByText("Carrots")).toBeVisible();

    // Confirm stocking
    const addButton = page.getByRole("button", { name: /Add .* item.* to inventory/ });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
