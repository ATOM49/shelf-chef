import { normalizeIngredientName } from "@/lib/inventory/normalize";
import { isStapleOrCustom } from "@/lib/inventory/staples";
import type { InventoryItem, InventoryUnit } from "@/lib/inventory/types";
import {
  convertQuantity,
  convertQuantityDetailed,
  getCanonicalUnitForGroup,
  getUnitGroup,
} from "@/lib/inventory/units";
import type { IngredientMatch, MealValidation, Recipe } from "@/lib/planner/types";

function pickBestInventoryItem(
  normalizedName: string,
  inventory: InventoryItem[],
  ingredientQuantity: number,
  ingredientUnit: InventoryUnit,
) {
  const namedMatches = inventory.filter((item) => item.normalizedName === normalizedName);
  if (namedMatches.length === 0) {
    return {
      item: undefined,
      resolvedNeeded: undefined,
      hasUnitMismatch: false,
      namedMatches,
    };
  }

  let bestItem: InventoryItem | undefined;
  let bestCoverage = -1;
  let bestResolved:
    | { quantity: number; unit: InventoryUnit; usesHeuristic: boolean }
    | undefined;
  let hasUnitMismatch = false;

  for (const item of namedMatches) {
    const converted = convertQuantityDetailed(
      ingredientQuantity,
      ingredientUnit,
      item.unit,
      normalizedName,
    );

    if (converted == null) {
      hasUnitMismatch = true;
      continue;
    }

    const coverage = item.quantity / converted.quantity;
    if (
      !bestItem ||
      coverage > bestCoverage ||
      (coverage === bestCoverage && item.quantity > bestItem.quantity) ||
      (coverage === bestCoverage &&
        item.quantity === bestItem.quantity &&
        bestResolved?.usesHeuristic === true &&
        converted.method === "direct")
    ) {
      bestItem = item;
      bestCoverage = coverage;
      bestResolved = {
        quantity: converted.quantity,
        unit: item.unit,
        usesHeuristic: converted.method === "heuristic",
      };
    }
  }

  return { item: bestItem, resolvedNeeded: bestResolved, hasUnitMismatch, namedMatches };
}

function summarizeNamedMatches(
  namedMatches: InventoryItem[],
  normalizedName: string,
  fallbackUnit: InventoryUnit,
) {
  if (namedMatches.length === 0) {
    return { quantity: 0, unit: fallbackUnit as InventoryUnit | "unknown" };
  }

  const uniqueUnits = Array.from(new Set(namedMatches.map((item) => item.unit)));
  const targetUnit =
    uniqueUnits.length === 1
      ? uniqueUnits[0]
      : getCanonicalUnitForGroup(getUnitGroup(fallbackUnit));

  let total = 0;
  for (const item of namedMatches) {
    const converted = convertQuantity(item.quantity, item.unit, targetUnit, normalizedName);
    if (converted == null) {
      return { quantity: 0, unit: "unknown" as const };
    }
    total += converted;
  }

  return {
    quantity: Number(total.toFixed(2)),
    unit: targetUnit,
  };
}

export function validateRecipeAgainstInventory(
  recipe: Recipe,
  inventory: InventoryItem[],
  customStapleNames: readonly string[] = [],
): MealValidation {
  const matches: IngredientMatch[] = recipe.ingredients.map((ingredient) => {
    const normalizedName = normalizeIngredientName(ingredient.normalizedName || ingredient.name);
    const fallbackUnit = getCanonicalUnitForGroup(getUnitGroup(ingredient.unit));
    const fallbackNeeded = convertQuantityDetailed(
      ingredient.quantity,
      ingredient.unit,
      fallbackUnit,
      normalizedName,
    );
    const { item, resolvedNeeded, hasUnitMismatch, namedMatches } = pickBestInventoryItem(
      normalizedName,
      inventory,
      ingredient.quantity,
      ingredient.unit,
    );

    if (!item || !resolvedNeeded) {
      const availableSummary = summarizeNamedMatches(namedMatches, normalizedName, ingredient.unit);

      if (namedMatches.length === 0 && !hasUnitMismatch && isStapleOrCustom(normalizedName, customStapleNames)) {
        return {
          ingredientName: ingredient.name,
          normalizedName,
          neededQuantity: ingredient.quantity,
          neededUnit: ingredient.unit,
          resolvedNeededQuantity: Number(
            (fallbackNeeded?.quantity ?? ingredient.quantity).toFixed(2),
          ),
          resolvedNeededUnit: fallbackUnit,
          measurementSource: "canonical",
          usesHeuristic: fallbackNeeded?.method === "heuristic",
          availableQuantity: 0,
          availableUnit: fallbackUnit,
          status: "staple",
          optional: ingredient.optional,
        };
      }

      return {
        ingredientName: ingredient.name,
        normalizedName,
        neededQuantity: ingredient.quantity,
        neededUnit: ingredient.unit,
        resolvedNeededQuantity: Number(
          (fallbackNeeded?.quantity ?? ingredient.quantity).toFixed(2),
        ),
        resolvedNeededUnit: fallbackUnit,
        measurementSource: "canonical",
        usesHeuristic: fallbackNeeded?.method === "heuristic",
        availableQuantity: availableSummary.quantity,
        availableUnit: availableSummary.unit,
        status: namedMatches.length > 0 && hasUnitMismatch ? "unit_mismatch" : "missing",
        optional: ingredient.optional,
      };
    }

    return {
      ingredientName: ingredient.name,
      normalizedName,
      neededQuantity: ingredient.quantity,
      neededUnit: ingredient.unit,
      resolvedNeededQuantity: Number(resolvedNeeded.quantity.toFixed(2)),
      resolvedNeededUnit: resolvedNeeded.unit,
      measurementSource: "inventory",
      usesHeuristic: resolvedNeeded.usesHeuristic,
      availableQuantity: Number(item.quantity.toFixed(2)),
      availableUnit: item.unit,
      status: item.quantity >= resolvedNeeded.quantity ? "enough" : "low",
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
    canCook: blockingMatches.every(
      (match) => match.status === "enough" || match.status === "staple",
    ),
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
  customStapleNames: readonly string[] = [],
): import("@/lib/planner/types").PlannedMeal[] {
  return meals.map((meal) => {
    if (meal.status === "completed") return meal;
    return {
      ...meal,
      validation: validateRecipeAgainstInventory(meal.recipe, inventory, customStapleNames),
    };
  });
}
