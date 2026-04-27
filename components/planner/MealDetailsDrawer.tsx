"use client";

import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import { RecipeIngredientList } from "@/components/planner/RecipeIngredientList";
import { Button } from "@/components/ui/button";
import type { IngredientMatch, PlannedMeal } from "@/lib/planner/types";

function describeMatch(match: IngredientMatch) {
  if (match.status === "staple") {
    return `${match.ingredientName}: assumed available as a kitchen staple`;
  }

  const recipeMeasurement = `${match.neededQuantity} ${match.neededUnit}`;
  const resolvedMeasurement = `${match.resolvedNeededQuantity} ${match.resolvedNeededUnit}`;
  const availability = `${match.availableQuantity} ${match.availableUnit}`;
  const status = match.status.replace("_", " ");
  const approximation = match.usesHeuristic ? "approx. " : "";

  if (match.measurementSource === "inventory") {
    if (match.resolvedNeededUnit === match.neededUnit && !match.usesHeuristic) {
      return `${match.ingredientName}: need ${recipeMeasurement}, available ${availability} · ${status}`;
    }

    return `${match.ingredientName}: recipe ${recipeMeasurement}, compare as ${approximation}${resolvedMeasurement}, available ${availability} · ${status}`;
  }

  if (match.availableUnit === "unknown") {
    return `${match.ingredientName}: recipe ${recipeMeasurement} · ${status}`;
  }

  return `${match.ingredientName}: recipe ${recipeMeasurement}, canonical ${approximation}${resolvedMeasurement}, available ${availability} · ${status}`;
}

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

  const isCooked = meal.status === "completed";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-zinc-400">
          {meal.day} · {meal.mealType}
          {meal.recipe.servings ? ` · ${meal.recipe.servings} servings` : ""}
        </div>
        <h3 className="text-lg font-semibold text-zinc-800">{meal.recipe.title}</h3>
        <div className="mt-2">
          <MealValidationSummary validation={meal.validation} />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-zinc-700">Meal actions</h4>
            <p className="mt-1 text-xs text-zinc-500">
              Marking as cooked consumes matched inventory items.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onSwap ? (
              <Button type="button" variant="outline" size="sm" onClick={onSwap}>
                Swap recipe
              </Button>
            ) : null}
            {onRemove ? (
              <Button type="button" variant="outline" size="sm" onClick={onRemove}>
                Eating out
              </Button>
            ) : null}
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={isCooked}
                disabled={isCooked}
                onChange={(event) => onSetCooked?.(event.currentTarget.checked)}
              />
              Cooked
            </label>
          </div>
        </div>
        {meal.recipe.referenceUrl ? (
          <a
            href={meal.recipe.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Open recipe source
          </a>
        ) : null}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-700">Ingredients</h4>
        {(() => {
          const stapleMatches = meal.validation.matches.filter(
            (m) => m.status === "staple",
          );
          return stapleMatches.length > 0 ? (
            <p className="mb-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-zinc-700">Assumed staples:</span>{" "}
              {stapleMatches.map((m) => m.ingredientName).join(", ")} — treated
              as always available and not checked against your inventory.
            </p>
          ) : null;
        })()}
        <RecipeIngredientList ingredients={meal.recipe.ingredients} matches={meal.validation.matches} />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-700">Validation details</h4>
        <div className="flex flex-col gap-2 text-sm text-zinc-600">
          {meal.validation.matches.map((match) => (
            <div key={`${match.normalizedName}-${match.neededUnit}`} className="rounded-lg bg-white px-3 py-2">
              {describeMatch(match)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
