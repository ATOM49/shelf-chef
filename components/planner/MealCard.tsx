"use client";

import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card
      className={`${isSelected ? "ring-2 ring-ring" : ""} ${isDragging ? "opacity-60" : ""}`}
      size="sm"
    >
      <CardContent className="space-y-2">
        <button type="button" className="w-full text-left" onClick={onSelect}>
          {/* <div className="flex items-center justify-between gap-2">
            <Badge variant={meal.status === "completed" ? "default" : "secondary"}>{meal.status}</Badge>
          </div> */}
          <div className="mt-2 text-sm font-semibold text-foreground">
            {meal.recipe.title}
          </div>
        </button>

        <MealValidationSummary validation={meal.validation} />

        <div className="flex items-center justify-between gap-2">
          {onSwap ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onSwap();
              }}
            >
              Swap
            </Button>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label={`Drag ${meal.recipe.title}`}
            className="cursor-grab rounded border bg-background px-2 py-1 leading-none text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
            onClick={(event) => event.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
