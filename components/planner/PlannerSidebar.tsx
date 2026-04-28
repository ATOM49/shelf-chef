"use client";

import { useMemo, useState } from "react";
import { PreferredDishChip } from "@/components/planner/PreferredDishChip";
import { PreferencesForm } from "@/components/planner/PreferencesForm";
import { Button } from "@/components/ui/button";
import { DrawerFooter } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  arePlannerConfigsEqual,
  createPlannerConfigSnapshot,
} from "@/lib/appState";
import { generateId } from "@/lib/id";
import type { PlannedMealType, PreferredDishRequest } from "@/lib/planner/types";

type DraftPreferredDish = Pick<PreferredDishRequest, "id" | "name" | "mealType">;

export function PlannerSidebar({
  savedPreferences,
  savedSelectedMealTypes,
  savedPreferredDishes,
  onSave,
  onCancel,
  isDisabled = false,
}: {
  savedPreferences: string;
  savedSelectedMealTypes: PlannedMealType[];
  savedPreferredDishes: PreferredDishRequest[];
  onSave: (payload: {
    preferences: string;
    selectedMealTypes: PlannedMealType[];
    preferredDishes: DraftPreferredDish[];
  }) => void;
  onCancel: () => void;
  isDisabled?: boolean;
}) {
  const [draftPreferences, setDraftPreferences] = useState(() => savedPreferences);
  const [draftSelectedMealTypes, setDraftSelectedMealTypes] = useState(
    () => savedSelectedMealTypes,
  );
  const [draftPreferredDishes, setDraftPreferredDishes] = useState<DraftPreferredDish[]>(
    () =>
      savedPreferredDishes.map((dish) => ({
        id: dish.id,
        name: dish.name,
        mealType: dish.mealType,
      })),
  );
  const [dishInput, setDishInput] = useState("");

  const hasChanges = useMemo(
    () =>
      !arePlannerConfigsEqual(
        createPlannerConfigSnapshot({
          preferences: savedPreferences,
          selectedMealTypes: savedSelectedMealTypes,
          preferredDishes: savedPreferredDishes,
        }),
        createPlannerConfigSnapshot({
          preferences: draftPreferences,
          selectedMealTypes: draftSelectedMealTypes,
          preferredDishes: draftPreferredDishes,
        }),
      ),
    [
      draftPreferences,
      draftPreferredDishes,
      draftSelectedMealTypes,
      savedPreferences,
      savedPreferredDishes,
      savedSelectedMealTypes,
    ],
  );

  function handleAddDish() {
    const name = dishInput.trim();
    if (!name) return;
    setDraftPreferredDishes((current) => [
      ...current,
      { id: generateId(), name, mealType: undefined },
    ]);
    setDishInput("");
  }

  function handleRemoveDish(dishId: string) {
    setDraftPreferredDishes((current) =>
      current.filter((dish) => dish.id !== dishId),
    );
  }

  function handleSave() {
    onSave({
      preferences: draftPreferences,
      selectedMealTypes: draftSelectedMealTypes,
      preferredDishes: draftPreferredDishes,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-4">
          <PreferencesForm
            preferences={draftPreferences}
            selectedMealTypes={draftSelectedMealTypes}
            onChange={setDraftPreferences}
            onMealTypesChange={setDraftSelectedMealTypes}
            disabled={isDisabled}
          />

          <section className="flex flex-col gap-3 rounded-xl border bg-background p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Preferred dishes</h3>
              <p className="text-xs text-muted-foreground">
                Type dishes you want this week. They stay saved until you update them again.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                className="flex-1"
                placeholder="e.g. Palak paneer, Lemon rice"
                value={dishInput}
                disabled={isDisabled}
                onChange={(e) => setDishInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddDish()}
              />
              <Button
                type="button"
                onClick={handleAddDish}
                disabled={isDisabled || !dishInput.trim()}
              >
                Add
              </Button>
            </div>
            {draftPreferredDishes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {draftPreferredDishes.map((dish) => (
                  <PreferredDishChip
                    key={dish.id}
                    dish={{ ...dish, status: "pending" }}
                    onRemove={handleRemoveDish}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nothing added yet — type a dish above!
              </p>
            )}
          </section>
        </div>
      </div>
      <DrawerFooter className="border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isDisabled || !hasChanges}
        >
          Save preferences
        </Button>
      </DrawerFooter>
    </div>
  );
}
