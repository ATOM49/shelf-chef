import type { InventoryItem } from "@/lib/inventory/types";
import { generateId } from "@/lib/id";
import { parsePreferences } from "@/lib/planner/preferences";
import type { PlannedMeal, Recipe } from "@/lib/planner/types";
import { validateRecipeAgainstInventory } from "@/lib/planner/validation";

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type PlannerInput = {
  inventory: InventoryItem[];
  preferences: string;
  recipes: Recipe[];
};

function isExpiringSoon(expiresAt?: string) {
  if (!expiresAt) return false;
  const now = new Date();
  const expiryDate = new Date(expiresAt);
  const diffDays = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 3;
}

function scoreRecipe(recipe: Recipe, inventory: InventoryItem[], preferences: string) {
  const parsed = parsePreferences(preferences);
  const validation = validateRecipeAgainstInventory(recipe, inventory);
  let score = 0;

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
    if (recipe.ingredients.some((ingredient) => ingredient.normalizedName === excludedIngredient)) {
      score -= 4;
    }
  }

  for (const boostedIngredient of parsed.boostedIngredients) {
    if (recipe.ingredients.some((ingredient) => ingredient.normalizedName === boostedIngredient)) {
      score += 2;
    }
  }

  const expiringSoonUsed = recipe.ingredients.some((ingredient) =>
    inventory.some(
      (item) => item.normalizedName === ingredient.normalizedName && isExpiringSoon(item.expiresAt),
    ),
  );

  if (expiringSoonUsed) {
    score += 1;
  }

  return { validation, score };
}

export function generateWeeklyDinnerPlan({ inventory, preferences, recipes }: PlannerInput): PlannedMeal[] {
  const dinnerRecipes = recipes.filter((recipe) => recipe.mealType === "dinner");
  const scoredRecipes = dinnerRecipes
    .map((recipe) => {
      const { validation, score } = scoreRecipe(recipe, inventory, preferences);
      return { recipe, validation, score };
    })
    .sort((left, right) => right.score - left.score || left.recipe.title.localeCompare(right.recipe.title));

  if (scoredRecipes.length === 0) {
    return [];
  }

  return WEEK_DAYS.map((day, index) => {
    const selected = scoredRecipes[index % scoredRecipes.length];

    return {
      id: generateId(),
      day,
      mealType: "dinner",
      recipe: selected.recipe,
      status: "planned",
      validation: selected.validation,
    };
  });
}
