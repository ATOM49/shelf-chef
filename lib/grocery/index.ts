import { generateId } from "@/lib/id";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { InventoryItem, InventoryUnit } from "@/lib/inventory/types";
import { convertQuantity } from "@/lib/inventory/units";
import type { GroceryCartItem, PlannedMeal } from "@/lib/planner/types";

type AggregatedNeed = {
  normalizedName: string;
  displayName: string;
  totalNeededInBaseUnit: number; // always stored in base unit (g for weight, ml for volume, count)
  unit: InventoryUnit;           // the unit to display (taken from first occurrence)
  baseUnit: InventoryUnit;       // "g" | "ml" | "count" — for internal accumulation
  recipeIds: Set<string>;
  recipeTitles: Set<string>;
};

/** Convert quantity to the base unit for its group (g, ml, or count). */
function toBaseUnit(quantity: number, unit: InventoryUnit): { baseQuantity: number; baseUnit: InventoryUnit } {
  if (unit === "kg") return { baseQuantity: quantity * 1000, baseUnit: "g" };
  if (unit === "l") return { baseQuantity: quantity * 1000, baseUnit: "ml" };
  if (unit === "tbsp") return { baseQuantity: quantity * 15, baseUnit: "ml" };
  if (unit === "tsp") return { baseQuantity: quantity * 5, baseUnit: "ml" };
  if (unit === "cup") return { baseQuantity: quantity * 240, baseUnit: "ml" };
  return { baseQuantity: quantity, baseUnit: unit };
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
): GroceryCartItem[] {
  const needsMap = new Map<string, AggregatedNeed>();

  for (const meal of meals) {
    if (meal.status === "completed") continue;

    for (const ingredient of meal.recipe.ingredients) {
      if (ingredient.optional) continue;

      const normalizedName = normalizeIngredientName(
        ingredient.normalizedName || ingredient.name,
      );
      const { baseQuantity, baseUnit } = toBaseUnit(ingredient.quantity, ingredient.unit);

      const existing = needsMap.get(normalizedName);
      if (existing) {
        if (existing.baseUnit === baseUnit) {
          existing.totalNeededInBaseUnit += baseQuantity;
        } else {
          // incompatible units for same ingredient name — skip aggregation, keep larger
          existing.totalNeededInBaseUnit = Math.max(
            existing.totalNeededInBaseUnit,
            baseQuantity,
          );
        }
        existing.recipeIds.add(meal.recipe.id);
        existing.recipeTitles.add(meal.recipe.title);
      } else {
        needsMap.set(normalizedName, {
          normalizedName,
          displayName: ingredient.name,
          totalNeededInBaseUnit: baseQuantity,
          unit: ingredient.unit,
          baseUnit,
          recipeIds: new Set([meal.recipe.id]),
          recipeTitles: new Set([meal.recipe.title]),
        });
      }
    }
  }

  // Build a stock map: normalizedName → total available in base unit
  const stockMap = new Map<string, number>();
  for (const item of inventory) {
    const { baseQuantity, baseUnit } = toBaseUnit(item.quantity, item.unit);
    const existing = stockMap.get(item.normalizedName);
    if (existing !== undefined) {
      // Only combine if same base unit group; skip otherwise (still count as some stock)
      const prev = needsMap.get(item.normalizedName);
      if (!prev || prev.baseUnit === baseUnit) {
        stockMap.set(item.normalizedName, (existing || 0) + baseQuantity);
      }
    } else {
      stockMap.set(item.normalizedName, baseQuantity);
    }
  }

  const cartItems: GroceryCartItem[] = [];

  for (const [normalizedName, need] of needsMap) {
    const available = stockMap.get(normalizedName) ?? 0;
    const shortage = need.totalNeededInBaseUnit - available;

    if (shortage <= 0) continue;

    // Convert shortage back to display unit
    const displayQty = toDisplayQuantity(shortage, need.baseUnit, need.unit);

    // Determine reason: if no stock at all → "missing", else → "low"
    const reason: "missing" | "low" = available === 0 ? "missing" : "low";

    cartItems.push({
      id: generateId(),
      normalizedName,
      displayName: need.displayName,
      neededQuantity: Number(displayQty.toFixed(2)),
      unit: need.unit,
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

function toDisplayQuantity(
  baseQuantity: number,
  baseUnit: InventoryUnit,
  originalUnit: InventoryUnit,
): number {
  const converted = convertQuantity(baseQuantity, baseUnit, originalUnit);
  return converted ?? baseQuantity;
}
