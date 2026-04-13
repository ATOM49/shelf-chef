"use client";

import { MealCard } from "@/components/planner/MealCard";
import type { PlannedMeal } from "@/lib/planner/types";

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

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
        Generate a plan to see meals and inventory validation.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {WEEK_DAYS.map((day) => {
        const dayMeals = MEAL_TYPES.map((mt) =>
          meals.find((m) => m.day === day && m.mealType === mt),
        ).filter(Boolean) as PlannedMeal[];

        if (dayMeals.length === 0) return null;

        return (
          <div key={day}>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
              {day}
            </div>
            <div className="flex flex-col gap-2">
              {dayMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  isSelected={meal.id === selectedMealId}
                  onSelect={() => onSelectMeal(meal.id)}
                  onComplete={() => onCompleteMeal(meal.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
