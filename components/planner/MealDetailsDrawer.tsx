"use client";

import { RecipeDetailPanel } from "@/components/planner/RecipeDetailPanel";
import type { PlannedMeal } from "@/lib/planner/types";

export function MealDetailsDrawer({
  meal,
  onSetCooked,
  onSwap,
  onRemove,
}: {
  meal?: PlannedMeal;
  onSetCooked?: (cooked: boolean) => void;
  onSwap?: () => void;
  onRemove?: () => void;
}) {
  if (!meal) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Select a planned meal to inspect recipe ingredients, inventory matches, and cookability.
      </div>
    );
  }

  return (
    <RecipeDetailPanel
      recipe={meal.recipe}
      validation={meal.validation}
      plannedMeal={meal}
      onSetCooked={onSetCooked}
      onSwap={onSwap}
      onRemove={onRemove}
    />
  );
}
