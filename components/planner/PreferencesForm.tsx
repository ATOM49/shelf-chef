"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  PLANNED_MEAL_TYPES,
  type PlannedMealType,
} from "@/lib/planner/types";

type PreferencesFormProps = {
  preferences: string;
  selectedMealTypes: PlannedMealType[];
  onChange: (preferences: string) => void;
  onMealTypesChange: (mealTypes: PlannedMealType[]) => void;
  disabled?: boolean;
};

export function PreferencesForm({
  preferences,
  selectedMealTypes,
  onChange,
  onMealTypesChange,
  disabled = false,
}: PreferencesFormProps) {
  function toggleMealType(mealType: PlannedMealType) {
    if (selectedMealTypes.includes(mealType)) {
      if (selectedMealTypes.length === 1) {
        return;
      }

      onMealTypesChange(
        selectedMealTypes.filter((current) => current !== mealType),
      );
      return;
    }

    const selected = new Set([...selectedMealTypes, mealType]);
    onMealTypesChange(
      PLANNED_MEAL_TYPES.filter((current) => selected.has(current)),
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
        <p className="text-xs text-muted-foreground">
          Tell us about your diet, goals, or what needs using up. Save, then hit &apos;Create plan&apos; to build your week.
        </p>
      </div>
      <Textarea
        rows={4}
        disabled={disabled}
        placeholder="High protein, Indian, use spinach soon, avoid mushrooms"
        value={preferences}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Meals to plan</p>
        <div className="flex flex-wrap gap-2">
          {PLANNED_MEAL_TYPES.map((mealType) => {
            const isSelected = selectedMealTypes.includes(mealType);
            const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
            return (
              <Button
                key={mealType}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                disabled={disabled}
                onClick={() => toggleMealType(mealType)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
