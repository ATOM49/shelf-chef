"use client";

import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlannedMeal } from "@/lib/planner/types";

type MealCardProps = {
  meal: PlannedMeal;
  isSelected: boolean;
  onSelect: () => void;
  onComplete: () => void;
};

export function MealCard({ meal, isSelected, onSelect, onComplete }: MealCardProps) {
  return (
    <Card className={isSelected ? "ring-2 ring-ring" : ""} size="sm">
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
          <Button
            type="button"
            size="sm"
            onClick={onComplete}
            disabled={meal.status === "completed" || !meal.validation.canCook}
          >
            Mark cooked
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
