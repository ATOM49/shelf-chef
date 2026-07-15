import { expect, test } from "@playwright/test";

import { createDefaultAppState } from "../lib/appState";
import type { AppState } from "../lib/appState";
import type { PlannedMeal, Recipe } from "../lib/planner/types";

function buildStateWithPendingRecipeImage(): AppState {
  const state = createDefaultAppState();
  const recipe: Recipe = {
    id: "recipe-image-test",
    title: "Paneer Test Curry",
    mealType: "dinner",
    cuisine: "Indian",
    servings: 2,
    tags: ["Quick"],
    ingredients: [
      {
        name: "Paneer",
        normalizedName: "paneer",
        quantity: 200,
        unit: "g",
      },
    ],
    instructions: ["Cook the paneer."],
    source: "user-requested",
    imageStatus: "pending",
    imageUpdatedAt: "2026-01-01T00:00:00.000Z",
  };
  const validation: PlannedMeal["validation"] = {
    canCook: true,
    matches: [],
    missingItems: [],
    lowItems: [],
  };

  state.inventory = [
    {
      id: "paneer-item",
      name: "Paneer",
      normalizedName: "paneer",
      quantity: 250,
      unit: "g",
      category: "protein",
      storageId: state.fridge.id,
      shelfId: "test-shelf",
      cellId: "cell-0-0",
    },
  ];
  state.recipes = [recipe];
  state.recipeImageGeneration = {
    recipeIds: [recipe.id],
    startedAt: "2026-01-01T00:00:00.000Z",
  };
  state.planner.weeklyPlan = [
    {
      id: "planned-meal-image-test",
      day: "Monday",
      mealType: "dinner",
      recipe,
      status: "planned",
      validation,
    },
  ];

  return state;
}

test("polls pending recipe image status and updates the planned meal card", async ({
  page,
}) => {
  const state = buildStateWithPendingRecipeImage();
  let statusRequestCount = 0;

  await page.route("**/api/households", async (route) => {
    await route.fulfill({ json: { households: [] } });
  });
  await page.route("**/api/state**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { state } });
      return;
    }

    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/recipes/images/status", async (route) => {
    statusRequestCount += 1;
    await route.fulfill({
      json: {
        images: [
          {
            recipeId: "recipe-image-test",
            imageStatus: statusRequestCount === 1 ? "generating" : "ready",
            imageUrl:
              statusRequestCount === 1
                ? undefined
                : "/api/recipes/images/recipe-image-job-test",
            imageUpdatedAt: "2026-01-01T00:00:05.000Z",
          },
        ],
      },
    });
  });
  await page.route(
    "**/api/recipes/images/recipe-image-job-test",
    async (route) => {
      await route.fulfill({
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
        contentType: "image/png",
      });
    },
  );

  await page.goto("/");

  await expect(page.getByText("Paneer Test Curry")).toBeVisible();
  await expect(page.getByText("Generating recipe images")).toBeVisible();
  await expect(page.getByText("0/1")).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("img", { name: "Paneer Test Curry" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Generating recipe images")).not.toBeVisible();
});
