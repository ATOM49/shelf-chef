"use client";

import { MealCard } from "@/components/planner/MealCard";
import { MealDetailsDrawer } from "@/components/planner/MealDetailsDrawer";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { PlannedMeal } from "@/lib/planner/types";

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

export function WeeklyPlanList({
  meals,
  selectedMealId,
  onSelectMeal,
  onCompleteMeal,
  onDeselectMeal,
}: {
  meals: PlannedMeal[];
  selectedMealId?: string;
  onSelectMeal: (mealId: string) => void;
  onCompleteMeal: (mealId: string) => void;
  onDeselectMeal: () => void;
}) {
  const selectedMeal = meals.find((meal) => meal.id === selectedMealId);

  if (meals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Generate a plan to see meals and inventory validation.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-muted/20 p-3">
        <div className="mb-2 text-xs text-muted-foreground">Scroll horizontally to navigate the week</div>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-3 snap-x snap-mandatory">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="w-40 shrink-0 md:w-auto md:flex-1 snap-start rounded-lg border bg-card p-3"
              >
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {day}
                </div>
                <div className="mt-3 grid gap-3">
                  {MEAL_TYPES.map((mealType) => {
                    const meal = meals.find((entry) => entry.day === day && entry.mealType === mealType);

                    return (
                      <div key={`${day}-${mealType}`} className="grid gap-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {mealType}
                        </div>
                        {meal ? (
                          <MealCard
                            meal={meal}
                            isSelected={meal.id === selectedMealId}
                            onSelect={() => onSelectMeal(meal.id)}
                            onComplete={() => onCompleteMeal(meal.id)}
                          />
                        ) : (
                          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                            No meal planned.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Drawer
        open={Boolean(selectedMealId)}
        onOpenChange={(open) => { if (!open) onDeselectMeal(); }}
      >
        <DrawerContent side="right" showCloseButton>
          <DrawerHeader>
            <DrawerTitle>Recipe details</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <MealDetailsDrawer meal={selectedMeal} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
