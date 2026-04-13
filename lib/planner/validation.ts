import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { InventoryItem } from "@/lib/inventory/types";
import { convertQuantity } from "@/lib/inventory/units";
import type { IngredientMatch, MealValidation, Recipe } from "@/lib/planner/types";

function pickBestInventoryItem(normalizedName: string, inventory: InventoryItem[], targetUnit: InventoryItem["unit"]) {
  const namedMatches = inventory.filter((item) => item.normalizedName === normalizedName);
  if (namedMatches.length === 0) {
    return { item: undefined, quantityInTargetUnit: 0, hasUnitMismatch: false };
  }

  let bestItem: InventoryItem | undefined;
  let bestQuantity = 0;
  let hasUnitMismatch = false;

  for (const item of namedMatches) {
    const converted = convertQuantity(item.quantity, item.unit, targetUnit);

    if (converted == null) {
      hasUnitMismatch = true;
      continue;
    }

    if (!bestItem || converted > bestQuantity) {
      bestItem = item;
      bestQuantity = converted;
    }
  }

  return { item: bestItem, quantityInTargetUnit: bestQuantity, hasUnitMismatch };
}

export function validateRecipeAgainstInventory(recipe: Recipe, inventory: InventoryItem[]): MealValidation {
  const matches: IngredientMatch[] = recipe.ingredients.map((ingredient) => {
    const normalizedName = normalizeIngredientName(ingredient.normalizedName || ingredient.name);
    const { item, quantityInTargetUnit, hasUnitMismatch } = pickBestInventoryItem(
      normalizedName,
      inventory,
      ingredient.unit,
    );

    if (!item) {
      return {
        ingredientName: ingredient.name,
        normalizedName,
        neededQuantity: ingredient.quantity,
        neededUnit: ingredient.unit,
        availableQuantity: 0,
        availableUnit: hasUnitMismatch ? "unknown" : ingredient.unit,
        status: hasUnitMismatch ? "unit_mismatch" : "missing",
        optional: ingredient.optional,
      };
    }

    return {
      ingredientName: ingredient.name,
      normalizedName,
      neededQuantity: ingredient.quantity,
      neededUnit: ingredient.unit,
      availableQuantity: Number(quantityInTargetUnit.toFixed(2)),
      availableUnit: ingredient.unit,
      status: quantityInTargetUnit >= ingredient.quantity ? "enough" : "low",
      matchedInventoryItemId: item.id,
      optional: ingredient.optional,
    };
  });

  const blockingMatches = matches.filter((match) => !match.optional);
  const missingItems = blockingMatches
    .filter((match) => match.status === "missing" || match.status === "unit_mismatch")
    .map((match) => match.ingredientName);
  const lowItems = blockingMatches
    .filter((match) => match.status === "low")
    .map((match) => match.ingredientName);

  return {
    canCook: blockingMatches.every((match) => match.status === "enough"),
    matches,
    missingItems,
    lowItems,
  };
}

/**
 * Re-validate all non-completed planned meals against the supplied inventory.
 * Returns a new array with updated validation objects; completed meals are unchanged.
 */
export function revalidatePlannedMeals(
  meals: import("@/lib/planner/types").PlannedMeal[],
  inventory: InventoryItem[],
): import("@/lib/planner/types").PlannedMeal[] {
  return meals.map((meal) => {
    if (meal.status === "completed") return meal;
    return { ...meal, validation: validateRecipeAgainstInventory(meal.recipe, inventory) };
  });
}
