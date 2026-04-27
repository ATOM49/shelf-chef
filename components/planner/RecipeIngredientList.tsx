"use client";

import type { IngredientMatch, RecipeIngredient } from "@/lib/planner/types";

function buildAvailabilityLabel(match: IngredientMatch) {
  if (match.status === "staple") {
    return "assumed available · kitchen staple";
  }

  const status = match.status.replace("_", " ");
  const recipeMeasurement = `${match.neededQuantity} ${match.neededUnit}`;
  const resolvedMeasurement = `${match.resolvedNeededQuantity} ${match.resolvedNeededUnit}`;
  const availability = `${match.availableQuantity} ${match.availableUnit}`;

  if (match.measurementSource === "inventory") {
    const approximation = match.usesHeuristic ? " approx." : "";
    if (match.resolvedNeededUnit !== match.neededUnit || match.usesHeuristic) {
      return `${status} · available ${availability} · compare ${resolvedMeasurement}${approximation} (recipe ${recipeMeasurement})`;
    }

    return `${status} · available ${availability}`;
  }

  if (match.availableUnit === "unknown") {
    return `${status} · recipe ${recipeMeasurement}`;
  }

  const approximation = match.usesHeuristic ? " approx." : "";
  return `${status} · available ${availability} · canonical ${resolvedMeasurement}${approximation}`;
}

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
          match?.status === "enough" || match?.status === "staple"
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
                {buildAvailabilityLabel(match)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
