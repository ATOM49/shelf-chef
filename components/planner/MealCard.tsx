"use client";

import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import type { PlannedMeal } from "@/lib/planner/types";

type MealCardProps = {
  meal: PlannedMeal;
  isSelected: boolean;
  onSelect: () => void;
  onComplete: () => void;
};

export function MealCard({ meal, isSelected, onSelect, onComplete }: MealCardProps) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isSelected ? "border-blue-300 bg-blue-50" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="flex-1 text-left" onClick={onSelect}>
          <div className="text-xs uppercase tracking-wide text-zinc-400">{meal.day}</div>
          <div className="text-sm font-semibold text-zinc-800">{meal.recipe.title}</div>
          <div className="mt-2">
            <MealValidationSummary validation={meal.validation} />
          </div>
        </button>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            meal.status === "completed" ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {meal.status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        {meal.recipe.referenceUrl ? (
          <a
            href={meal.recipe.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700"
          >
            Open recipe
          </a>
        ) : (
          <span className="text-zinc-400">No recipe link</span>
        )}
        <button
          type="button"
          onClick={onComplete}
          disabled={meal.status === "completed" || !meal.validation.canCook}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          Mark cooked
        </button>
      </div>
    </div>
  );
}
