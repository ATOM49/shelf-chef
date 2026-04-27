import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { mergeRecipes } from "@/lib/appState";
import {
  generateRecipeResponse,
  generateWeeklyPlannerResponse,
} from "@/lib/planner/generate";
import {
  buildRecipeGenerationPrompt,
  buildWeeklyPlannerPrompt,
} from "@/lib/planner/prompts";
import {
  parsePlannerGenerationApiResponse,
  plannerGenerateRequestSchema,
} from "@/lib/planner/schema";
import type { PlannedMealType, Recipe } from "@/lib/planner/types";

const MAX_PLANNER_POOL_SIZE = 72;

function selectPlannerRecipePool(
  recipes: Recipe[],
  prioritizedMealTypes: PlannedMealType[],
) {
  if (recipes.length <= MAX_PLANNER_POOL_SIZE) {
    return recipes;
  }

  const sourcePriority = (recipe: Recipe) =>
    recipe.source === "user-saved" ? 0 : 1;
  const prioritized = [...recipes].sort(
    (left, right) =>
      sourcePriority(left) - sourcePriority(right) ||
      left.mealType.localeCompare(right.mealType, "en-US") ||
      left.title.localeCompare(right.title, "en-US"),
  );
  const pool: Recipe[] = [];
  const seenIds = new Set<string>();
  const orderedMealTypes: Array<Recipe["mealType"]> = [
    ...prioritizedMealTypes,
    ...(["breakfast", "lunch", "dinner"] as const).filter(
      (mealType) => !prioritizedMealTypes.includes(mealType),
    ),
  ];

  for (const mealType of orderedMealTypes) {
    for (const recipe of prioritized) {
      if (recipe.mealType !== mealType || seenIds.has(recipe.id)) {
        continue;
      }

      pool.push(recipe);
      seenIds.add(recipe.id);

      if (pool.length >= MAX_PLANNER_POOL_SIZE) {
        return pool;
      }
    }
  }

  for (const recipe of prioritized) {
    if (seenIds.has(recipe.id)) {
      continue;
    }

    pool.push(recipe);
    seenIds.add(recipe.id);

    if (pool.length >= MAX_PLANNER_POOL_SIZE) {
      break;
    }
  }

  return pool;
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedRequest = plannerGenerateRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return Response.json({ error: "A valid planner request is required." }, { status: 400 });
  }

  try {
    const recipesResponse = await generateRecipeResponse(
      buildRecipeGenerationPrompt(parsedRequest.data),
      parsedRequest.data.preferredDishes,
      parsedRequest.data.inventory,
    );
    const mergedRecipeBook = mergeRecipes(
      parsedRequest.data.recipeBook,
      recipesResponse.recipes,
    );
    const plannerRecipePool = selectPlannerRecipePool(
      mergedRecipeBook,
      parsedRequest.data.mealTypes,
    );
    const plannerResponse = await generateWeeklyPlannerResponse(
      buildWeeklyPlannerPrompt({
        preferences: parsedRequest.data.preferences,
        preferredDishes: parsedRequest.data.preferredDishes,
        mealTypes: parsedRequest.data.mealTypes,
        recipes: plannerRecipePool,
      }),
      plannerRecipePool,
      parsedRequest.data.mealTypes,
    );

    return Response.json(
      parsePlannerGenerationApiResponse({
        recipes: mergedRecipeBook,
        mealSlots: plannerResponse.mealSlots,
      }),
    );
  } catch (err) {
    const status = isLlmConfigurationError(err) ? 500 : 502;
    return Response.json(
      {
        error: isLlmConfigurationError(err) ? "LLM configuration error" : "LLM call failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status },
    );
  }
}
