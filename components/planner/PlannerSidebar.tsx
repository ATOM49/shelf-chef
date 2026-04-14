"use client";

import { useState } from "react";
import { PreferredDishChip } from "@/components/planner/PreferredDishChip";
import { PreferencesForm } from "@/components/planner/PreferencesForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WeeklyPlanList } from "@/components/planner/WeeklyPlanList";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AppAction, AppState } from "@/lib/appState";

export function PlannerSidebar({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}) {
  const [dishInput, setDishInput] = useState("");

  function handleAddDish() {
    const name = dishInput.trim();
    if (!name) return;
    dispatch({ type: "ADD_PREFERRED_DISH", name });
    setDishInput("");
  }

  return (
    <div className="flex flex-col gap-4">
      <Accordion multiple defaultValue={["customise-plan", "plan"]} className="rounded-xl border bg-muted/20 p-3">
        <AccordionItem value="customise-plan" className="border-none">
          <AccordionTrigger className="px-1 py-2 text-sm font-semibold text-foreground hover:no-underline">
            Customise Plan
          </AccordionTrigger>
          <AccordionContent className="pt-1">
            <div className="flex flex-col gap-4">
              <PreferencesForm
                preferences={state.planner.preferences}
                onChange={(preferences) => dispatch({ type: "SET_PREFERENCES", preferences })}
                onGeneratePlan={() => dispatch({ type: "GENERATE_WEEKLY_PLAN" })}
              />

              <section className="flex flex-col gap-3 rounded-xl border bg-background p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Preferred dishes</h3>
                  <p className="text-xs text-muted-foreground">
                    Type dishes you want this week. Resolved dishes are prioritised in the plan.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    className="flex-1"
                    placeholder="e.g. Palak paneer, Lemon rice"
                    value={dishInput}
                    onChange={(e) => setDishInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddDish()}
                  />
                  <Button
                    type="button"
                    onClick={handleAddDish}
                    disabled={!dishInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                {state.planner.preferredDishes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {state.planner.preferredDishes.map((dish) => (
                      <PreferredDishChip
                        key={dish.id}
                        dish={dish}
                        onRemove={(id) => dispatch({ type: "REMOVE_PREFERRED_DISH", dishId: id })}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="plan" className="border-none">
          <AccordionTrigger className="px-1 py-2 text-sm font-semibold text-foreground hover:no-underline">
            Plan
          </AccordionTrigger>
          <AccordionContent className="pt-1">
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Weekly plan</h3>
                <p className="text-xs text-muted-foreground">
                  Each meal is validated against current inventory before you cook it.
                </p>
              </div>
              <WeeklyPlanList
                meals={state.planner.weeklyPlan}
                selectedMealId={state.planner.selectedMealId}
                onSelectMeal={(mealId) => dispatch({ type: "SELECT_MEAL", mealId })}
                onSetMealCooked={(mealId, cooked) => dispatch({ type: "SET_MEAL_COOKED", mealId, cooked })}
                onMoveMealSlot={(mealId, day, mealType) =>
                  dispatch({ type: "MOVE_PLANNED_MEAL_SLOT", mealId, day, mealType })}
                onDeselectMeal={() => dispatch({ type: "SELECT_MEAL", mealId: undefined })}
              />
            </section>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
