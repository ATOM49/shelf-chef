import type { InventoryItem } from "@/lib/inventory/types";
import type { PlannedMeal } from "@/lib/planner/types";

export function applyMealConsumption(inventory: InventoryItem[], plannedMeal: PlannedMeal) {
  if (plannedMeal.status === "completed") {
    return inventory;
  }

  return inventory.map((item) => {
    const matchingIngredients = plannedMeal.validation.matches.filter(
      (match) =>
        (match.status === "enough" || match.status === "low") &&
        match.matchedInventoryItemId === item.id,
    );

    if (matchingIngredients.length === 0) {
      return item;
    }

    // If any match is "low" (not enough), deplete all available stock for this item.
    // Otherwise consume only what each "enough" match needs.
    const hasLowMatch = matchingIngredients.some((match) => match.status === "low");
    const usedQuantity = hasLowMatch
      ? item.quantity
      : matchingIngredients.reduce((total, match) => total + match.resolvedNeededQuantity, 0);

    return {
      ...item,
      quantity: Math.max(0, Number((item.quantity - usedQuantity).toFixed(2))),
    };
  });
}
