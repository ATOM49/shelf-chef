import type { InventoryItem } from "@/lib/inventory/types";
import type { PlannedMeal } from "@/lib/planner/types";

export function applyMealConsumption(inventory: InventoryItem[], plannedMeal: PlannedMeal) {
  if (plannedMeal.status === "completed" || !plannedMeal.validation.canCook) {
    return inventory;
  }

  return inventory.map((item) => {
    const matchingIngredients = plannedMeal.validation.matches.filter(
      (match) => match.status === "enough" && match.matchedInventoryItemId === item.id,
    );

    if (matchingIngredients.length === 0) {
      return item;
    }

    const usedQuantity = matchingIngredients.reduce((total, match) => {
      return total + match.resolvedNeededQuantity;
    }, 0);

    return {
      ...item,
      quantity: Math.max(0, Number((item.quantity - usedQuantity).toFixed(2))),
    };
  });
}
