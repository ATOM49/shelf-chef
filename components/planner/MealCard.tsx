"use client";

import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PlannedMeal } from "@/lib/planner/types";
import type { ButtonHTMLAttributes } from "react";

type MealCardProps = {
  meal: PlannedMeal;
  isSelected: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onSetCooked: (cooked: boolean) => void;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
};

export function MealCard({
  meal,
  isSelected,
  isDragging = false,
  onSelect,
  onSetCooked,
  dragHandleProps,
}: MealCardProps) {
  const isCooked = meal.status === "completed";
  const isCheckboxDisabled = isCooked || !meal.validation.canCook;

  return (
    <Card className={`${isSelected ? "ring-2 ring-ring" : ""} ${isDragging ? "opacity-60" : ""}`} size="sm">
      <CardContent className="space-y-2">
        <button type="button" className="w-full text-left" onClick={onSelect}>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="capitalize">
              {meal.mealType}
            </Badge>
            <Badge variant={meal.status === "completed" ? "default" : "secondary"}>{meal.status}</Badge>
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">{meal.recipe.title}</div>
        </button>

        <MealValidationSummary validation={meal.validation} />

        <div className="flex items-center justify-between gap-3 text-xs">
          {meal.recipe.referenceUrl ? (
            <a
              href={meal.recipe.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Open recipe
            </a>
          ) : (
            <span className="text-muted-foreground">No recipe link</span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={`Drag ${meal.recipe.title}`}
              className="cursor-grab rounded border bg-background px-2 py-1 leading-none text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
              onClick={(event) => event.stopPropagation()}
              {...dragHandleProps}
            >
              ⋮⋮
            </button>
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={isCooked}
                disabled={isCheckboxDisabled}
                onChange={(event) => onSetCooked(event.currentTarget.checked)}
              />
              Cooked
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
