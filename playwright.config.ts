import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  outputDir: "./tests/e2e/videos",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "tests/e2e/report", open: "never" }]],

  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    video: "on",
    trace: "on-first-retry",
    // Auth session cookie is injected for all tests by default.
    // Individual tests that need an unauthenticated context create their own.
    storageState: "tests/e2e/.auth/user.json",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
});
