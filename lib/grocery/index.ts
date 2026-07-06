import { generateId } from "@/lib/id";
import { isStapleOrCustom } from "@/lib/inventory/staples";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { InventoryItem, InventoryUnit } from "@/lib/inventory/types";
import {
  convertQuantity,
  getCanonicalUnitForGroup,
  getUnitGroup,
} from "@/lib/inventory/units";
import type { GroceryCartItem, PlannedMeal } from "@/lib/planner/types";

type AggregatedNeed = {
  normalizedName: string;
  emoji?: string;
  displayName: string;
  totalNeededInDisplayUnit: number;
  displayUnit: InventoryUnit;
  hasNamedInventory: boolean;
  recipeIds: Set<string>;
  recipeTitles: Set<string>;
};

function pickInventoryEmoji(items: InventoryItem[]) {
  return items.find((item) => item.emoji?.trim())?.emoji;
}

function resolveCartDisplayUnit(
  normalizedName: string,
  recipeUnit: InventoryUnit,
  matchingInventory: InventoryItem[],
) {
  if (matchingInventory.length === 0) {
    return {
      displayUnit: getCanonicalUnitForGroup(getUnitGroup(recipeUnit)),
      hasNamedInventory: false,
    };
  }

  const uniqueUnits = Array.from(new Set(matchingInventory.map((item) => item.unit)));
  if (
    uniqueUnits.length === 1 &&
    convertQuantity(1, recipeUnit, uniqueUnits[0], normalizedName) != null
  ) {
    return {
      displayUnit: uniqueUnits[0],
      hasNamedInventory: true,
    };
  }

  return {
    displayUnit: getCanonicalUnitForGroup(getUnitGroup(recipeUnit)),
    hasNamedInventory: true,
  };
}

/**
 * Build a grocery cart from all non-completed planned meals.
 *
 * For each recipe ingredient across the week:
 *  1. Sum total needed (aggregated per normalised ingredient name)
 *  2. Subtract current inventory stock once
 *  3. Emit a GroceryCartItem only when shortage > 0
 */
export function buildGroceryCartFromMeals(
  meals: PlannedMeal[],
  inventory: InventoryItem[],
  customStapleNames: readonly string[] = [],
): GroceryCartItem[] {
  const needsMap = new Map<string, AggregatedNeed>();
  const inventoryByName = new Map<string, InventoryItem[]>();

  for (const item of inventory) {
    // Re-normalize with the current normalizer so items persisted under an
    // older scheme still key the same way as freshly-normalized recipe names.
    const inventoryKey = normalizeIngredientName(item.normalizedName || item.name);
    const existing = inventoryByName.get(inventoryKey) ?? [];
    inventoryByName.set(inventoryKey, [...existing, item]);
  }

  for (const meal of meals) {
    if (meal.status === "completed") continue;

    for (const ingredient of meal.recipe.ingredients) {
      if (ingredient.optional) continue;

      const normalizedName = normalizeIngredientName(
        ingredient.normalizedName || ingredient.name,
      );

      if (isStapleOrCustom(normalizedName, customStapleNames)) continue;
      const existing = needsMap.get(normalizedName);
      const matchingInventory = inventoryByName.get(normalizedName) ?? [];
      const resolvedDisplay = existing
        ? {
            displayUnit: existing.displayUnit,
            hasNamedInventory: existing.hasNamedInventory,
          }
        : resolveCartDisplayUnit(normalizedName, ingredient.unit, matchingInventory);
      const resolvedQuantity = convertQuantity(
        ingredient.quantity,
        ingredient.unit,
        resolvedDisplay.displayUnit,
        normalizedName,
      );
      if (resolvedQuantity == null) {
        continue;
      }

      if (existing) {
        existing.totalNeededInDisplayUnit += resolvedQuantity;
        existing.hasNamedInventory =
          existing.hasNamedInventory || resolvedDisplay.hasNamedInventory;
        existing.emoji ??= pickInventoryEmoji(matchingInventory) ?? ingredient.emoji;
        existing.recipeIds.add(meal.recipe.id);
        existing.recipeTitles.add(meal.recipe.title);
      } else {
        needsMap.set(normalizedName, {
          normalizedName,
          emoji: pickInventoryEmoji(matchingInventory) ?? ingredient.emoji,
          displayName: ingredient.name,
          totalNeededInDisplayUnit: resolvedQuantity,
          displayUnit: resolvedDisplay.displayUnit,
          hasNamedInventory: resolvedDisplay.hasNamedInventory,
          recipeIds: new Set([meal.recipe.id]),
          recipeTitles: new Set([meal.recipe.title]),
        });
      }
    }
  }

  const cartItems: GroceryCartItem[] = [];

  for (const [normalizedName, need] of needsMap) {
    const matchingInventory = inventoryByName.get(normalizedName) ?? [];
    const available = matchingInventory.reduce((total, item) => {
      const converted = convertQuantity(item.quantity, item.unit, need.displayUnit, normalizedName);
      return total + (converted ?? 0);
    }, 0);
    const shortage = need.totalNeededInDisplayUnit - available;

    if (shortage <= 0) continue;
    const reason: "missing" | "low" = need.hasNamedInventory ? "low" : "missing";

    cartItems.push({
      id: generateId(),
      emoji: need.emoji,
      normalizedName,
      displayName: need.displayName,
      neededQuantity: Number(shortage.toFixed(2)),
      unit: need.displayUnit,
      reason,
      recipeIds: Array.from(need.recipeIds),
      recipeTitles: Array.from(need.recipeTitles),
      checked: false,
    });
  }

  // Sort: missing first, then low; alphabetically within groups
  cartItems.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === "missing" ? -1 : 1;
    return a.displayName.localeCompare(b.displayName, "en-US");
  });

  return cartItems;
}
