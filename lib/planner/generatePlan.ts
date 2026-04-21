import { buildGroceryCartFromMeals } from "@/lib/grocery";
import type { InventoryItem } from "@/lib/inventory/types";
import { generateId } from "@/lib/id";
import { parsePreferences } from "@/lib/planner/preferences";
import type {
  GroceryCartItem,
  PlannedMeal,
  PlannedMealType,
  PlannerMealSlot,
  PreferredDishRequest,
  Recipe,
} from "@/lib/planner/types";
import { PLANNER_WEEK_DAYS } from "@/lib/planner/types";
import { validateRecipeAgainstInventory } from "@/lib/planner/validation";

type MealType = Recipe["mealType"];
const MEAL_TYPES: PlannedMealType[] = ["breakfast", "lunch", "dinner"];

type PlannerInput = {
  inventory: InventoryItem[];
  preferences: string;
  recipes: Recipe[];
  preferredDishes?: PreferredDishRequest[];
};

type PlannerOutput = {
  meals: PlannedMeal[];
  groceryCart: GroceryCartItem[];
};

function isExpiringSoon(expiresAt?: string) {
  if (!expiresAt) return false;
  const now = new Date();
  const expiryDate = new Date(expiresAt);
  const diffDays = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 3;
}

function scoreRecipe(
  recipe: Recipe,
  inventory: InventoryItem[],
  preferences: string,
  isPinned: boolean,
) {
  const parsed = parsePreferences(preferences);
  const validation = validateRecipeAgainstInventory(recipe, inventory);
  let score = isPinned ? 1000 : 0;

  for (const match of validation.matches) {
    if (match.status === "enough") score += 3;
    if (match.status === "low") score += 1;
    if ((match.status === "missing" || match.status === "unit_mismatch") && !match.optional) {
      score -= 5;
    }
  }

  for (const tag of parsed.preferredTags) {
    if (recipe.tags.some((recipeTag) => recipeTag.toLowerCase() === tag)) {
      score += 2;
    }
  }

  for (const cuisine of parsed.preferredCuisines) {
    if (recipe.cuisine?.toLowerCase() === cuisine) {
      score += 2;
    }
  }

  for (const excludedIngredient of parsed.excludedIngredients) {
    if (recipe.ingredients.some((i) => i.normalizedName === excludedIngredient)) {
      score -= 4;
    }
  }

  for (const boostedIngredient of parsed.boostedIngredients) {
    if (recipe.ingredients.some((i) => i.normalizedName === boostedIngredient)) {
      score += 2;
    }
  }

  const expiringSoonUsed = recipe.ingredients.some((ingredient) =>
    inventory.some(
      (item) =>
        item.normalizedName === ingredient.normalizedName && isExpiringSoon(item.expiresAt),
    ),
  );
  if (expiringSoonUsed) score += 1;

  return { validation, score };
}

/** Build a set of pinned recipe IDs from resolved preferred dishes, per meal type. */
function buildPinnedMap(
  preferredDishes: PreferredDishRequest[],
  recipes: Recipe[],
): Map<MealType, Recipe[]> {
  const map = new Map<MealType, Recipe[]>();
  for (const dish of preferredDishes) {
    if (dish.status !== "resolved" || !dish.resolvedRecipeId) continue;
    const recipe = recipes.find((r) => r.id === dish.resolvedRecipeId);
    if (!recipe) continue;
    const mt = dish.mealType ?? recipe.mealType;
    const existing = map.get(mt) ?? [];
    if (!existing.some((r) => r.id === recipe.id)) {
      map.set(mt, [...existing, recipe]);
    }
  }
  return map;
}

export function generateWeeklyPlan({
  inventory,
  preferences,
  recipes,
  preferredDishes = [],
}: PlannerInput): PlannerOutput {
  const pinnedMap = buildPinnedMap(preferredDishes, recipes);

  const meals: PlannedMeal[] = [];
  // Track recipes used per meal-type to encourage diversity across days
  const usedIds = new Map<MealType, Set<string>>();

  for (const mealType of MEAL_TYPES) {
    usedIds.set(mealType, new Set());

    const pinnedRecipes = pinnedMap.get(mealType) ?? [];
    const pinnedIds = new Set(pinnedRecipes.map((r) => r.id));

    const candidateRecipes = recipes.filter((r) => r.mealType === mealType);
    if (candidateRecipes.length === 0) continue;

    // Score all candidates, pinned ones get the 1000-point boost
    const scored = candidateRecipes
      .map((recipe) => {
        const { validation, score } = scoreRecipe(
          recipe,
          inventory,
          preferences,
          pinnedIds.has(recipe.id),
        );
        return { recipe, validation, score };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.recipe.title.localeCompare(b.recipe.title, "en-US"),
      );

    // For each day, pick the best recipe not yet used for this meal type
    let fallbackIndex = 0;
    for (const day of PLANNER_WEEK_DAYS) {
      const used = usedIds.get(mealType)!;
      const pick =
        scored.find((s) => !used.has(s.recipe.id)) ?? scored[fallbackIndex % scored.length];
      fallbackIndex++;

      used.add(pick.recipe.id);
      meals.push({
        id: generateId(),
        day,
        mealType,
        recipe: pick.recipe,
        status: "planned",
        validation: pick.validation,
      });
    }
  }

  // Sort meals: Monday→Sunday, within each day: breakfast, lunch, dinner
  const dayOrder = Object.fromEntries(PLANNER_WEEK_DAYS.map((d, i) => [d, i]));
  const mealTypeOrder: Record<MealType, number> = {
    breakfast: 0,
    lunch: 1,
    dinner: 2,
    snack: 3,
  };
  meals.sort(
    (a, b) =>
      dayOrder[a.day] - dayOrder[b.day] ||
      mealTypeOrder[a.mealType] - mealTypeOrder[b.mealType],
  );

  const groceryCart = buildGroceryCartFromMeals(meals, inventory);

  return { meals, groceryCart };
}

// Legacy export kept for any existing call sites — delegates to new function
export function generateWeeklyDinnerPlan(params: {
  inventory: InventoryItem[];
  preferences: string;
  recipes: Recipe[];
}): PlannedMeal[] {
  return generateWeeklyPlan(params).meals.filter((m) => m.mealType === "dinner");
}

export function buildGeneratedWeeklyPlan(params: {
  inventory: InventoryItem[];
  recipes: Recipe[];
  mealSlots: PlannerMealSlot[];
}): PlannerOutput {
  const recipeMap = new Map(params.recipes.map((recipe) => [recipe.id, recipe]));
  const meals: PlannedMeal[] = [];

  for (const mealSlot of params.mealSlots) {
    const recipe = recipeMap.get(mealSlot.recipeId);
    if (!recipe) {
      continue;
    }

    meals.push({
      id: generateId(),
      day: mealSlot.day,
      mealType: mealSlot.mealType,
      recipe,
      status: "planned",
      validation: validateRecipeAgainstInventory(recipe, params.inventory),
    });
  }

  const dayOrder = Object.fromEntries(PLANNER_WEEK_DAYS.map((day, index) => [day, index]));
  const mealTypeOrder: Record<PlannedMealType, number> = {
    breakfast: 0,
    lunch: 1,
    dinner: 2,
  };
  meals.sort(
    (a, b) =>
      dayOrder[a.day] - dayOrder[b.day] ||
      mealTypeOrder[a.mealType] - mealTypeOrder[b.mealType],
  );

  return {
    meals,
    groceryCart: buildGroceryCartFromMeals(meals, params.inventory),
  };
}

