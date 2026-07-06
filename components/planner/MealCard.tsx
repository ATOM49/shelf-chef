"use client";

import { RecipeCard } from "@/components/entities/RecipeCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DragHandle } from "@/components/ui/drag-handle";
import type { PlannedMeal } from "@/lib/planner/types";
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
      showMealType={false}
      validation={meal.validation}
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
          <DragHandle
            aria-label={`Drag ${meal.recipe.title}`}
            {...dragHandleProps}
          />
        </>
      }
    />
  );
}
