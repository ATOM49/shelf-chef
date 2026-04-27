"use client";

import { useState } from "react";
import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import { RecipeIngredientList } from "@/components/planner/RecipeIngredientList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import type { IngredientMatch, MealValidation, PlannedMeal, Recipe } from "@/lib/planner/types";

function formatMealTypeLabel(mealType: Recipe["mealType"]) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

function formatSourceLabel(source: Recipe["source"]) {
  return source === "user-saved" ? "saved" : "generated";
}

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

type RecipeDetailPanelProps = {
  recipe: Recipe;
  validation: MealValidation;
  /** When provided, shows planner-specific context (day, mealType, servings) and meal actions. */
  plannedMeal?: PlannedMeal;
  onSetCooked?: (cooked: boolean) => void;
  onSwap?: () => void;
  onRemove?: () => void;
  /** When provided, renders a "Back to recipes" button at the top. */
  onBack?: () => void;
  /** When provided and recipe.source is "user-saved", renders a delete confirmation popover. */
  onDelete?: (recipeId: string) => void;
};

export function RecipeDetailPanel({
  recipe,
  validation,
  plannedMeal,
  onSetCooked,
  onSwap,
  onRemove,
  onBack,
  onDelete,
}: RecipeDetailPanelProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isCooked = plannedMeal?.status === "completed";
  const stapleMatches = validation.matches.filter((m) => m.status === "staple");

  const detailStats = [
    { label: "Ingredients", value: String(recipe.ingredients.length) },
    { label: "Steps", value: String(recipe.instructions?.length ?? 0) },
    { label: "Tags", value: String(recipe.tags.length) },
  ];

  return (
    <div className="grid gap-4 sm:gap-5">
      {/* Header: back button, context line, title, badges, stats grid, delete */}
      <div className="space-y-4">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3 w-fit"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to recipes
          </Button>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            {plannedMeal ? (
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {plannedMeal.day} · {plannedMeal.mealType}
                {recipe.servings ? ` · ${recipe.servings} servings` : ""}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{formatMealTypeLabel(recipe.mealType)}</Badge>
              <Badge variant="secondary">{formatSourceLabel(recipe.source)}</Badge>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                {recipe.title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
                {recipe.cuisine ? `${recipe.cuisine} cuisine` : "Kitchen staple"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:max-w-sm">
              {detailStats.map((stat) => (
                <div
                  key={`${recipe.id}-${stat.label}`}
                  className="rounded-xl border bg-background/80 px-3 py-2"
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {stat.label}
                  </div>
                  <div className="mt-1 text-base font-semibold text-foreground">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {onDelete && recipe.source === "user-saved" ? (
            <Popover open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <PopoverTrigger
                type="button"
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
              >
                <Trash2 className="size-4" aria-hidden />
                Delete recipe
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-80 p-4">
                <PopoverHeader>
                  <PopoverTitle>Delete this recipe?</PopoverTitle>
                  <PopoverDescription>
                    This removes the saved recipe from your recipe book. You can regenerate
                    it later from your inventory.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      onDelete(recipe.id);
                    }}
                  >
                    Delete recipe
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      {/* Meal actions — shown only in planner context */}
      {plannedMeal ? (
        <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Meal actions</h4>
              <p className="mt-1 text-xs text-muted-foreground">
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
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
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
          {recipe.referenceUrl ? (
            <a
              href={recipe.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Open recipe source
            </a>
          ) : null}
        </section>
      ) : null}

      {/* Cookability */}
      <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Cookability
          </p>
          <h4 className="text-base font-semibold text-foreground">Inventory check</h4>
        </div>
        <div className="mt-3">
          <MealValidationSummary validation={validation} />
        </div>
      </section>

      {/* Tags */}
      {recipe.tags.length > 0 ? (
        <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Tags
            </p>
            <h4 className="text-base font-semibold text-foreground">Recipe notes</h4>
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {recipe.tags.map((tag) => (
              <Badge key={`${recipe.id}-${tag}`} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {/* Ingredients */}
      <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Ingredients
          </p>
          <h4 className="text-base font-semibold text-foreground">What you need</h4>
        </div>
        <div className="mt-3">
          {stapleMatches.length > 0 ? (
            <p className="mb-3 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Assumed staples:</span>{" "}
              {stapleMatches.map((m) => m.ingredientName).join(", ")} — treated as always
              available and not checked against your inventory.
            </p>
          ) : null}
          <RecipeIngredientList
            ingredients={recipe.ingredients}
            matches={validation.matches}
          />
        </div>
      </section>

      {/* Verbose validation details — planner context only */}
      {plannedMeal ? (
        <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Validation
            </p>
            <h4 className="text-base font-semibold text-foreground">Validation details</h4>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            {validation.matches.map((match) => (
              <div
                key={`${match.normalizedName}-${match.neededUnit}`}
                className="rounded-lg border bg-muted/20 px-3 py-2"
              >
                {describeMatch(match)}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Cooking steps */}
      {recipe.instructions && recipe.instructions.length > 0 ? (
        <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Method
            </p>
            <h4 className="text-base font-semibold text-foreground">Cooking steps</h4>
          </div>
          <ol className="mt-3 grid gap-2.5 text-sm text-muted-foreground sm:gap-3">
            {recipe.instructions.map((instruction, index) => (
              <li
                key={`${recipe.id}-step-${index}`}
                className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border bg-muted/20 px-3 py-3 sm:px-4"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground">
                  {index + 1}
                </span>
                <span className="pt-0.5 leading-6">{instruction}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Source — shown in recipe-book context only (planner context embeds the URL in meal actions) */}
      {recipe.referenceUrl && !plannedMeal ? (
        <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Source
            </p>
            <h4 className="text-base font-semibold text-foreground">Original recipe</h4>
          </div>
          <div className="mt-3">
            <a
              href={recipe.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
            >
              <ExternalLink className="size-4" aria-hidden />
              Open recipe source
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
