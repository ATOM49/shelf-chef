"use client";

import { MealDetailsDrawer } from "@/components/planner/MealDetailsDrawer";
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
  const selectedMeal = state.planner.weeklyPlan.find((meal) => meal.id === state.planner.selectedMealId);

  return (
    <div className="flex flex-col gap-4">
      <PreferencesForm
        preferences={state.planner.preferences}
        onChange={(preferences) => dispatch({ type: "SET_PREFERENCES", preferences })}
        onGeneratePlan={() => dispatch({ type: "GENERATE_WEEKLY_PLAN" })}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Weekly plan</h3>
          <p className="text-xs text-zinc-500">Each dinner is validated against current inventory before you cook it.</p>
        </div>
        <WeeklyPlanList
          meals={state.planner.weeklyPlan}
          selectedMealId={state.planner.selectedMealId}
          onSelectMeal={(mealId) => dispatch({ type: "SELECT_MEAL", mealId })}
          onCompleteMeal={(mealId) => dispatch({ type: "COMPLETE_MEAL", mealId })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Meal details</h3>
          <p className="text-xs text-zinc-500">Review ingredient matches and exact stock impact before checking off a meal.</p>
        </div>
        <MealDetailsDrawer meal={selectedMeal} />
      </section>
    </div>
  );
}
