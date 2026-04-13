"use client";

import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import { RecipeIngredientList } from "@/components/planner/RecipeIngredientList";
import type { PlannedMeal } from "@/lib/planner/types";

export function MealDetailsDrawer({ meal }: { meal?: PlannedMeal }) {
  if (!meal) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Select a planned meal to inspect recipe ingredients, inventory matches, and cookability.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-zinc-400">
          {meal.day} · {meal.mealType}
        </div>
        <h3 className="text-lg font-semibold text-zinc-800">{meal.recipe.title}</h3>
        <div className="mt-2">
          <MealValidationSummary validation={meal.validation} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-700">Ingredients</h4>
        <RecipeIngredientList ingredients={meal.recipe.ingredients} matches={meal.validation.matches} />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-700">Validation details</h4>
        <div className="flex flex-col gap-2 text-sm text-zinc-600">
          {meal.validation.matches.map((match) => (
            <div key={`${match.normalizedName}-${match.neededUnit}`} className="rounded-lg bg-white px-3 py-2">
              {match.ingredientName}: need {match.neededQuantity} {match.neededUnit}, available {match.availableQuantity}{" "}
              {match.availableUnit} · {match.status.replace("_", " ")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
