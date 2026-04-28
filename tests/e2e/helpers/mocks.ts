import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserContext } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf-8")) as unknown;
}

// Pre-load fixture JSON at module init time
const stockTextFixture = loadFixture("stock-text-response.json");
const stockPresetFixture = loadFixture("stock-preset-response.json");
const plannerGenerateFixture = loadFixture("planner-generate-response.json");
const recipeGenerateFixture = loadFixture("recipe-generate-response.json");
const recipeGenerateCustomFixture = loadFixture("recipe-generate-custom-response.json");

/**
 * Register route intercepts on a browser context that return static fixture
 * responses for every LLM-backed API route.  Call this inside test.beforeEach.
 */
export async function mockLlmRoutes(context: BrowserContext): Promise<void> {
  await context.route("**/api/stock", (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stockTextFixture) });
    }
    return route.continue();
  });

  await context.route("**/api/stock/preset", (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stockPresetFixture) });
    }
    return route.continue();
  });

  await context.route("**/api/planner/generate", (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plannerGenerateFixture) });
    }
    return route.continue();
  });

  // Custom recipe generate must be matched before the broader generate route
  await context.route("**/api/recipes/generate/custom", (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(recipeGenerateCustomFixture) });
    }
    return route.continue();
  });

  await context.route("**/api/recipes/generate", (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(recipeGenerateFixture) });
    }
    return route.continue();
  });
}
