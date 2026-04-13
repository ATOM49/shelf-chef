"use client";

import type { IngredientMatch, RecipeIngredient } from "@/lib/planner/types";

export function RecipeIngredientList({
  ingredients,
  matches,
}: {
  ingredients: RecipeIngredient[];
  matches: IngredientMatch[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {ingredients.map((ingredient) => {
        const match = matches.find((candidate) => candidate.normalizedName === ingredient.normalizedName);
        const statusTone =
          match?.status === "enough"
            ? "text-green-700"
            : match?.status === "low"
              ? "text-yellow-700"
              : "text-red-700";

        return (
          <div
            key={`${ingredient.normalizedName}-${ingredient.unit}`}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-zinc-800">{ingredient.name}</span>
              <span className="text-zinc-500">
                {ingredient.quantity} {ingredient.unit}
                {ingredient.optional ? " · optional" : ""}
              </span>
            </div>
            {match ? (
              <div className={`mt-1 text-xs ${statusTone}`}>
                {match.status.replace("_", " ")} · available {match.availableQuantity} {match.availableUnit}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
