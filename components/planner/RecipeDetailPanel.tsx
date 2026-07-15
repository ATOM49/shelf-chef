"use client";

import { useState } from "react";
import { formatMealTypeLabel } from "@/components/entities/RecipeCard";
import {
  getValidationTone,
  MealValidationIndicator,
} from "@/components/planner/MealValidationSummary";
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
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ExternalLink,
  ImageIcon,
  RefreshCw,
  Tags,
  Trash2,
  Users,
  Utensils,
} from "lucide-react";
import type {
  MealValidation,
  PlannedMeal,
  Recipe,
} from "@/lib/planner/types";

type RecipeDetailPanelProps = {
  recipe: Recipe;
  validation: MealValidation;
  /** When provided, shows planner-specific context and persistent meal actions. */
  plannedMeal?: PlannedMeal;
  onSetCooked?: (cooked: boolean) => void;
  onSwap?: () => void;
  onRemove?: () => void;
  /** When provided, renders a back control over the recipe image. */
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
  const showImage = recipe.imageStatus === "ready" && recipe.imageUrl;
  const validationTone = getValidationTone(validation);
  const mealType = plannedMeal?.mealType ?? recipe.mealType;
  const infoTags = recipe.tags.filter(
    (tag) => tag.trim().toLowerCase() !== mealType.trim().toLowerCase(),
  );
  const canDelete = Boolean(onDelete && recipe.source === "user-saved");

  return (
    <div className="flex h-full min-h-0 flex-col bg-popover">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <header
          className="sticky top-0 z-0 flex aspect-[16/10] min-h-56 w-full items-end overflow-hidden bg-muted sm:aspect-[16/9] sm:min-h-72"
        >
          <div
            className="absolute inset-0 scale-[1.04] bg-cover bg-center will-change-transform"
            style={
              showImage
                ? { backgroundImage: `url("${recipe.imageUrl}")` }
                : undefined
            }
          />
          {!showImage ? (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,hsl(var(--background)),hsl(var(--muted)))]">
              <ImageIcon className="size-8 text-muted-foreground" aria-hidden />
            </div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/25" />

          {onBack ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute left-4 top-4 z-10 bg-background/85 shadow-sm backdrop-blur hover:bg-background sm:left-6 sm:top-5"
              onClick={onBack}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to recipes
            </Button>
          ) : null}

          <div className="relative z-10 max-w-3xl space-y-1.5 px-4 pb-7 text-white sm:px-6 sm:pb-9">
            <h3 className="text-3xl font-semibold font-serif leading-[1.05] text-balance drop-shadow-sm sm:text-4xl">
              {recipe.title}
            </h3>
            <p className="text-sm text-white/80">
              {recipe.cuisine ? `${recipe.cuisine} cuisine` : "Kitchen staple"}
            </p>
          </div>
        </header>

        <div className="relative z-10 -mt-3 space-y-4 rounded-t-3xl bg-popover px-4 pb-6 pt-5 sm:space-y-5 sm:px-6 sm:pb-8 sm:pt-6">
          <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Ingredients
                </p>
                <h4 className="text-base font-serif font-semibold text-foreground">
                  What you need
                </h4>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline" className={validationTone.classes}>
                  {validationTone.label}
                </Badge>
                <MealValidationIndicator validation={validation} />
              </div>
            </div>
            <div className="mt-3">
              <RecipeIngredientList
                ingredients={recipe.ingredients}
                matches={validation.matches}
              />
            </div>
          </section>

          {recipe.instructions && recipe.instructions.length > 0 ? (
            <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Method
                </p>
                <h4 className="text-base font-serif font-semibold text-foreground">
                  Recipe steps
                </h4>
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

          <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Info
              </p>
              <h4 className="text-base font-serif font-semibold text-foreground">
                Recipe details
              </h4>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              {plannedMeal ? (
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">Day</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {plannedMeal.day}
                    </dd>
                  </div>
                </div>
              ) : null}
              <div className="flex items-start gap-2.5">
                <Utensils
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <dt className="text-xs text-muted-foreground">Meal type</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatMealTypeLabel(mealType)}
                  </dd>
                </div>
              </div>
              {recipe.servings ? (
                <div className="flex items-start gap-2.5">
                  <Users
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div>
                    <dt className="text-xs text-muted-foreground">Servings</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {recipe.servings}
                    </dd>
                  </div>
                </div>
              ) : null}
            </dl>

            {infoTags.length > 0 ? (
              <div className="mt-4 border-t pt-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Tags className="size-4" aria-hidden />
                  Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {infoTags.map((tag) => (
                    <Badge key={`${recipe.id}-${tag}`} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {recipe.referenceUrl || canDelete ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                {recipe.referenceUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={recipe.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Open recipe source
                  </Button>
                ) : null}

                {onDelete && canDelete ? (
                  <Popover
                    open={deleteConfirmOpen}
                    onOpenChange={setDeleteConfirmOpen}
                  >
                    <PopoverTrigger
                      render={
                        <Button type="button" variant="outline" size="sm" />
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete recipe
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={8}
                      className="w-80 p-4"
                    >
                      <PopoverHeader>
                        <PopoverTitle>Delete this recipe?</PopoverTitle>
                        <PopoverDescription>
                          This recipe will be removed from your book. You can
                          always regenerate it later.
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
            ) : null}
          </section>
        </div>
      </div>

      {plannedMeal ? (
        <footer className="relative z-20 shrink-0 border-t bg-popover/95 px-3 py-3 shadow-[0_-8px_24px_-20px_rgba(0,0,0,0.6)] backdrop-blur sm:px-4">
          <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            {onSwap ? (
              <Button type="button" variant="outline" onClick={onSwap}>
                <RefreshCw className="size-4" aria-hidden />
                <span className="hidden sm:inline">Swap recipe</span>
                <span className="sm:hidden">Swap</span>
              </Button>
            ) : null}
            {onRemove ? (
              <Button
                type="button"
                variant="outline"
                aria-label="Eating out"
                onClick={onRemove}
              >
                <Utensils className="size-4" aria-hidden />
                <span className="hidden sm:inline">Eating out</span>
                <span className="sm:hidden">Out</span>
              </Button>
            ) : null}
            <Button
              type="button"
              aria-label={isCooked ? "Cooked" : "Mark cooked"}
              disabled={isCooked || !onSetCooked}
              onClick={() => onSetCooked?.(true)}
            >
              <Check className="size-4" aria-hidden />
              <span className="hidden sm:inline">
                {isCooked ? "Cooked" : "Mark cooked"}
              </span>
              <span className="sm:hidden">Cooked</span>
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
