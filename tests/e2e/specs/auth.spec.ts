import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("unauthenticated visit redirects to /signin", async ({ browser }) => {
    // Use a brand-new context with no stored cookies
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/signin/);
    await context.close();
  });

  test("pre-seeded session lands on the app", async ({ page }) => {
    // storageState with the seeded session cookie is injected by the project config
    await page.goto("/");
    // The app redirects away from /signin and shows the ShelfChef heading
    await expect(page.getByRole("heading", { name: "ShelfChef" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
