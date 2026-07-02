import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { getRecipeDedupeKey, mergeRecipes } from "@/lib/appState";
import {
  generateCustomRecipeResponse,
  generateRecipeResponse,
  generateWeeklyPlannerResponse,
} from "@/lib/planner/generate";
import {
  buildDishRecipeGenerationPrompt,
  buildRecipeGenerationPrompt,
  buildWeeklyPlannerPrompt,
} from "@/lib/planner/prompts";
import {
  parsePlannerGenerationApiResponse,
  plannerGenerateRequestSchema,
} from "@/lib/planner/schema";
import { resolveRecipeByDishName } from "@/lib/recipes/resolve";
import { PLANNER_WEEK_DAYS } from "@/lib/planner/types";
import type {
  PlannedMealType,
  PlannerMealSlot,
  PlannerPreferredDishInput,
  PlannerWeekDay,
  Recipe,
} from "@/lib/planner/types";

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

function resolveForcedMealType(
  dishMealType: PlannerPreferredDishInput["mealType"],
  selectedMealTypes: PlannedMealType[],
): PlannedMealType {
  const candidate: PlannedMealType =
    dishMealType && dishMealType !== "snack" ? dishMealType : "dinner";
  return selectedMealTypes.includes(candidate) ? candidate : selectedMealTypes[0];
}

function createForcedSlotDayPicker() {
  const cursors = new Map<PlannedMealType, number>();
  const occupied = new Set<string>();

  return (mealType: PlannedMealType): PlannerWeekDay => {
    const start = cursors.get(mealType) ?? 0;
    for (let offset = 0; offset < PLANNER_WEEK_DAYS.length; offset++) {
      const index = (start + offset) % PLANNER_WEEK_DAYS.length;
      const day = PLANNER_WEEK_DAYS[index];
      const key = `${day}:${mealType}`;
      if (!occupied.has(key)) {
        occupied.add(key);
        cursors.set(mealType, index + 1);
        return day;
      }
    }
    // All 7 days already forced for this meal type; wrap and accept a collision
    // (only reachable with 8+ forced dishes sharing one meal type in one request).
    const fallbackIndex = start % PLANNER_WEEK_DAYS.length;
    cursors.set(mealType, fallbackIndex + 1);
    return PLANNER_WEEK_DAYS[fallbackIndex];
  };
}

async function generateForcedPreferredDishRecipes(
  unresolvedDishes: PlannerPreferredDishInput[],
  preferences: string,
  recipeBook: Recipe[],
) {
  const results = await Promise.allSettled(
    unresolvedDishes.map((dish) =>
      generateCustomRecipeResponse(
        buildDishRecipeGenerationPrompt({
          mode: "dish",
          dishName: dish.name,
          preferences,
          recipeBook,
        }),
        [],
      ),
    ),
  );

  const forced: Array<{ dish: PlannerPreferredDishInput; recipe: Recipe }> = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      forced.push({
        dish: unresolvedDishes[index],
        recipe: { ...result.value.recipe, source: "user-requested" as const },
      });
    }
    // rejected: leave dish unresolved — client will show "Not found" via reconcilePreferredDishes
  });
  return forced;
}

function applyForcedSlotOverrides(
  mealSlots: PlannerMealSlot[],
  overrides: PlannerMealSlot[],
) {
  if (overrides.length === 0) return mealSlots;
  const bySlotKey = new Map(mealSlots.map((slot) => [`${slot.day}:${slot.mealType}`, slot]));
  for (const override of overrides) {
    bySlotKey.set(`${override.day}:${override.mealType}`, override);
  }
  return Array.from(bySlotKey.values());
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

    const unresolvedPreferredDishes = parsedRequest.data.preferredDishes.filter((dish) => {
      const candidates = dish.mealType
        ? mergedRecipeBook.filter((recipe) => recipe.mealType === dish.mealType)
        : mergedRecipeBook;
      return resolveRecipeByDishName(dish.name, candidates) === null;
    });

    let finalRecipeBook = mergedRecipeBook;
    const forcedSlotOverrides: PlannerMealSlot[] = [];

    if (unresolvedPreferredDishes.length > 0) {
      const forcedResults = await generateForcedPreferredDishRecipes(
        unresolvedPreferredDishes,
        parsedRequest.data.preferences,
        mergedRecipeBook,
      );
      const pickForcedSlotDay = createForcedSlotDayPicker();

      for (const { dish, recipe } of forcedResults) {
        finalRecipeBook = mergeRecipes(finalRecipeBook, [recipe]);
        const dedupeKey = getRecipeDedupeKey(recipe);
        const resolvedRecipe =
          finalRecipeBook.find((candidate) => getRecipeDedupeKey(candidate) === dedupeKey) ??
          recipe;
        const mealType = resolveForcedMealType(dish.mealType, parsedRequest.data.mealTypes);
        const day = pickForcedSlotDay(mealType);
        forcedSlotOverrides.push({ day, mealType, recipeId: resolvedRecipe.id });
      }
    }

    const plannerRecipePool = selectPlannerRecipePool(
      finalRecipeBook,
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
        recipes: finalRecipeBook,
        mealSlots: applyForcedSlotOverrides(plannerResponse.mealSlots, forcedSlotOverrides),
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
