"use client";

import type { ReactNode } from "react";
import { ChefHat } from "lucide-react";

import { isInteractiveTarget } from "@/components/entities/card-interaction";
import { MealValidationIndicator } from "@/components/planner/MealValidationSummary";
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

type RecipeCardData = Pick<Recipe, "title" | "mealType"> &
  Partial<Pick<Recipe, "cuisine" | "servings" | "tags">>;

type RecipeCardProps = {
  recipe: RecipeCardData;
  /** Shows the meal type badge in the header row. */
  showMealType?: boolean;
  /** Adds the meal type to the tag row. */
  includeMealTypeTag?: boolean;
  /** How many tag badges to render (0 hides tags). */
  maxTags?: number;
  /** Extra contextual chips appended to the header badge row. */
  badges?: ReactNode;
  /** Flags missing/low ingredients with a compact icon callout in the header. */
  validation?: MealValidation;
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
  showMealType = true,
  includeMealTypeTag = false,
  maxTags = 0,
  badges,
  validation,
  onOpen,
  selected = false,
  dragging = false,
  footer,
  className,
}: RecipeCardProps) {
  const interactive = Boolean(onOpen);
  const showValidation = validation !== undefined && !validation.canCook;
  const hasHeaderBadges = showMealType || Boolean(badges) || showValidation;
  const cardTags = includeMealTypeTag
    ? [
        formatMealTypeLabel(recipe.mealType),
        ...(recipe.tags ?? []).filter(
          (tag) =>
            tag.trim().toLowerCase() !== recipe.mealType.trim().toLowerCase(),
        ),
      ]
    : (recipe.tags ?? []);
  const visibleTags = maxTags > 0 ? cardTags.slice(0, maxTags) : [];
  const hiddenTagCount = cardTags.length - visibleTags.length;

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
        {hasHeaderBadges ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {showMealType ? (
              <Badge variant="outline">{formatMealTypeLabel(recipe.mealType)}</Badge>
            ) : null}
            {badges}
            {showValidation && validation ? (
              <MealValidationIndicator validation={validation} className="ml-auto" />
            ) : null}
          </div>
        ) : null}
        <CardTitle className="line-clamp-2 font-serif" title={recipe.title}>
          {recipe.title}
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <ChefHat className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            {recipe.cuisine ?? "Kitchen staple"}
            {recipe.servings ? ` · ${recipe.servings} servings` : ""}
          </span>
        </CardDescription>
      </CardHeader>
      {visibleTags.length > 0 ? (
        <CardContent>
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
        </CardContent>
      ) : null}
      {footer ? (
        <CardFooter className="mt-auto justify-between gap-2">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}
