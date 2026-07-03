"use client";

import { RecipeCard } from "@/components/entities/RecipeCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlannedMeal } from "@/lib/planner/types";
import { GripVertical } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type MealCardProps = {
  meal: PlannedMeal;
  isSelected: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onSwap?: () => void;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
};

export function MealCard({
  meal,
  isSelected,
  isDragging = false,
  onSelect,
  onSwap,
  dragHandleProps,
}: MealCardProps) {
  return (
    <RecipeCard
      recipe={meal.recipe}
      validation={meal.validation}
      maxValidationItems={2}
      onOpen={onSelect}
      selected={isSelected}
      dragging={isDragging}
      badges={
        meal.status === "completed" ? (
          <Badge variant="secondary">Cooked</Badge>
        ) : null
      }
      footer={
        <>
          {onSwap ? (
            <Button type="button" size="sm" variant="outline" onClick={onSwap}>
              Swap
            </Button>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label={`Drag ${meal.recipe.title}`}
            className="cursor-grab rounded border bg-background px-2 py-1 leading-none text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        </>
      }
    />
  );
}
