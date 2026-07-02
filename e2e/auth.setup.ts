import { test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

// API-based auth per https://playwright.dev/docs/auth: hits the dev-only
// login endpoint directly instead of driving the sign-in form, then saves
// the resulting session cookie for every test in the "chromium" project.
setup("authenticate", async ({ request }) => {
  const response = await request.post("/api/dev-login", {
    data: {
      email: process.env.DEV_LOGIN_EMAIL ?? "playwright@stockpot.test",
      password: process.env.DEV_LOGIN_PASSWORD ?? "devpassword",
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Dev login failed (${response.status()}). Make sure ENABLE_DEV_LOGIN=true and ` +
        `DEV_LOGIN_PASSWORD are set in .env.local before running Playwright.`,
    );
  }

  await request.storageState({ path: authFile });
});
