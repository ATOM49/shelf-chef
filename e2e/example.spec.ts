import { test, expect } from "@playwright/test";

test("signed-in user does not get redirected to /signin", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/signin/);
});
