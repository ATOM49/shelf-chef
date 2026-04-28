import type { Page } from "@playwright/test";

/**
 * Reset the authenticated user's personal workspace state to the default empty
 * state via the app API.  Call this in afterEach hooks to keep tests isolated.
 */
export async function resetUserState(page: Page): Promise<void> {
  await page.request.put("/api/state", {
    data: { state: null },
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Wait for the main app to finish its initial loading/bootstrapping phase.
 * The app shows a loading spinner while it fetches state and households.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for the stocking button (always present in the app header once loaded)
  await page.waitForSelector('[aria-label="Stock items"]', { timeout: 15_000 });
}
