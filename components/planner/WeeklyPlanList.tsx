"use client";

import { MealCard } from "@/components/planner/MealCard";
import type { PlannedMeal } from "@/lib/planner/types";

export function WeeklyPlanList({
  meals,
  selectedMealId,
  onSelectMeal,
  onCompleteMeal,
}: {
  meals: PlannedMeal[];
  selectedMealId?: string;
  onSelectMeal: (mealId: string) => void;
  onCompleteMeal: (mealId: string) => void;
}) {
  if (meals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Generate a dinner-only weekly plan to see meals and inventory validation.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {meals.map((meal) => (
        <MealCard
          key={meal.id}
          meal={meal}
          isSelected={meal.id === selectedMealId}
          onSelect={() => onSelectMeal(meal.id)}
          onComplete={() => onCompleteMeal(meal.id)}
        />
      ))}
    </div>
  );
}
