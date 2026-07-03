"use client";

import type { ReactNode } from "react";

import { isInteractiveTarget } from "@/components/entities/card-interaction";
import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MealValidation, Recipe } from "@/lib/planner/types";

export function formatMealTypeLabel(mealType: Recipe["mealType"]) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

export function formatSourceLabel(source: Recipe["source"]) {
  return source === "user-saved" ? "saved" : "generated";
}

type RecipeCardData = Pick<Recipe, "title" | "mealType"> &
  Partial<Pick<Recipe, "cuisine" | "servings" | "source" | "tags">>;

type RecipeCardProps = {
  recipe: RecipeCardData;
  /** Shows the saved/generated badge next to the meal type. */
  showSource?: boolean;
  /** How many tag badges to render (0 hides tags). */
  maxTags?: number;
  /** Extra contextual chips appended to the header badge row. */
  badges?: ReactNode;
  /** Renders the availability summary (Ready / Missing / Low + gap badges). */
  validation?: MealValidation;
  /** Caps the number of gap badges in the availability summary. */
  maxValidationItems?: number;
  /** Makes the whole card clickable (nested controls still work). */
  onOpen?: () => void;
  selected?: boolean;
  dragging?: boolean;
  /** Contextual actions pinned to the bottom edge. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Square card-view of a recipe — the standard way a recipe appears in grids
 * and planner slots. Context decides what to surface via `badges`,
 * `validation`, and `footer`.
 */
export function RecipeCard({
  recipe,
  showSource = false,
  maxTags = 0,
  badges,
  validation,
  maxValidationItems,
  onOpen,
  selected = false,
  dragging = false,
  footer,
  className,
}: RecipeCardProps) {
  const interactive = Boolean(onOpen);
  const visibleTags = maxTags > 0 ? (recipe.tags ?? []).slice(0, maxTags) : [];
  const hiddenTagCount = (recipe.tags?.length ?? 0) - visibleTags.length;

  return (
    <Card
      size="sm"
      className={cn(
        "h-full",
        interactive &&
          "cursor-pointer transition-shadow hover:ring-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-ring",
        dragging && "opacity-60",
        className,
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? (event) => {
              if (isInteractiveTarget(event)) return;
              onOpen?.();
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              if (isInteractiveTarget(event)) return;
              event.preventDefault();
              onOpen?.();
            }
          : undefined
      }
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{formatMealTypeLabel(recipe.mealType)}</Badge>
          {showSource && recipe.source ? (
            <Badge variant="secondary">{formatSourceLabel(recipe.source)}</Badge>
          ) : null}
          {badges}
        </div>
        <CardTitle className="line-clamp-2 font-serif" title={recipe.title}>
          {recipe.title}
        </CardTitle>
        <CardDescription className="line-clamp-1">
          {recipe.cuisine ? `${recipe.cuisine} cuisine` : "Kitchen staple"}
          {recipe.servings ? ` · ${recipe.servings} servings` : ""}
        </CardDescription>
      </CardHeader>
      {validation || visibleTags.length > 0 ? (
        <CardContent className="space-y-2">
          {visibleTags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {visibleTags.map((tag) => (
                <Badge key={tag} variant="outline" className="max-w-full">
                  <span className="truncate">{tag}</span>
                </Badge>
              ))}
              {hiddenTagCount > 0 ? (
                <Badge variant="ghost">+{hiddenTagCount}</Badge>
              ) : null}
            </div>
          ) : null}
          {validation ? (
            <MealValidationSummary
              validation={validation}
              maxItems={maxValidationItems}
            />
          ) : null}
        </CardContent>
      ) : null}
      {footer ? (
        <CardFooter className="mt-auto justify-between gap-2">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}
