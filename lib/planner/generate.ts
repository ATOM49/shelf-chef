import { generateStructuredObject } from "../ai/structured";
import type {
  PlannerInventoryContextItem,
  PlannerPreferredDishInput,
  Recipe,
} from "@/lib/planner/types";
import {
  parsePlannerMealSlotsModelResponse,
  parseRecipeGenerationModelResponse,
  plannerMealSlotsModelResponseSchema,
  recipeGenerationModelResponseSchema,
} from "@/lib/planner/schema";

export async function generateRecipeResponse(
  prompt: string,
  preferredDishes: PlannerPreferredDishInput[],
  inventory: PlannerInventoryContextItem[],
) {
  const response = await generateStructuredObject({
    enableGoogleSearch: true,
    prompt,
    schema: recipeGenerationModelResponseSchema,
  });

  return parseRecipeGenerationModelResponse(response, preferredDishes, inventory);
}

export async function generateWeeklyPlannerResponse(
  prompt: string,
  recipes: Recipe[],
) {
  const response = await generateStructuredObject({
    enableGoogleSearch: true,
    prompt,
    schema: plannerMealSlotsModelResponseSchema,
  });

  return parsePlannerMealSlotsModelResponse(response, recipes);
}

export async function generateCustomRecipeResponse(
  prompt: string,
  inventory: PlannerInventoryContextItem[],
) {
  const response = await generateStructuredObject({
    enableGoogleSearch: true,
    prompt,
    schema: recipeGenerationModelResponseSchema,
  });
  const parsed = parseRecipeGenerationModelResponse(response, [], inventory);

  const recipe = parsed.recipes[0];
  if (!recipe) {
    throw new Error("AI didn't return a usable recipe. Try again.");
  }

  return { recipe };
}