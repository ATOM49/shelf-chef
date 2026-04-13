"use client";

import { useState } from "react";
import { GroceryCartPanel } from "@/components/planner/GroceryCartPanel";
import { MealDetailsDrawer } from "@/components/planner/MealDetailsDrawer";
import { PreferredDishChip } from "@/components/planner/PreferredDishChip";
import { PreferencesForm } from "@/components/planner/PreferencesForm";
import { WeeklyPlanList } from "@/components/planner/WeeklyPlanList";
import type { AppAction, AppState } from "@/lib/appState";

export function PlannerSidebar({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}) {
  const selectedMeal = state.planner.weeklyPlan.find(
    (meal) => meal.id === state.planner.selectedMealId,
  );

  const [dishInput, setDishInput] = useState("");

  function handleAddDish() {
    const name = dishInput.trim();
    if (!name) return;
    dispatch({ type: "ADD_PREFERRED_DISH", name });
    setDishInput("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section 1: Preferences */}
      <PreferencesForm
        preferences={state.planner.preferences}
        onChange={(preferences) => dispatch({ type: "SET_PREFERENCES", preferences })}
        onGeneratePlan={() => dispatch({ type: "GENERATE_WEEKLY_PLAN" })}
      />

      {/* Section 2: Preferred dishes */}
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Preferred dishes</h3>
          <p className="text-xs text-zinc-500">
            Type dishes you want this week. Resolved dishes are prioritised in the plan.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g. Palak paneer, Lemon rice"
            value={dishInput}
            onChange={(e) => setDishInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDish()}
          />
          <button
            type="button"
            onClick={handleAddDish}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-300"
            disabled={!dishInput.trim()}
          >
            Add
          </button>
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

      {/* Section 3: Weekly plan */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Weekly plan</h3>
          <p className="text-xs text-zinc-500">
            Each meal is validated against current inventory before you cook it.
          </p>
        </div>
        <WeeklyPlanList
          meals={state.planner.weeklyPlan}
          selectedMealId={state.planner.selectedMealId}
          onSelectMeal={(mealId) => dispatch({ type: "SELECT_MEAL", mealId })}
          onCompleteMeal={(mealId) => dispatch({ type: "COMPLETE_MEAL", mealId })}
        />
      </section>

      {/* Section 4: Meal details */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Meal details</h3>
          <p className="text-xs text-zinc-500">
            Review ingredient matches and exact stock impact before checking off a meal.
          </p>
        </div>
        <MealDetailsDrawer meal={selectedMeal} />
      </section>

      {/* Section 5: Grocery cart */}
      <GroceryCartPanel
        items={state.planner.groceryCart}
        onToggle={(id) => dispatch({ type: "TOGGLE_GROCERY_ITEM", itemId: id })}
      />
    </div>
  );
}
