"use client";

import type { MealValidation } from "@/lib/planner/types";

export function getValidationTone(validation: MealValidation) {
  if (validation.canCook) {
    return {
      label: "Ready",
      classes: "border-green-200 bg-green-100 text-green-800",
    };
  }

  if (validation.missingItems.length > 0) {
    return {
      label: "Missing items",
      classes: "border-red-200 bg-red-100 text-red-800",
    };
  }

  return {
    label: "Low stock",
    classes: "border-yellow-200 bg-yellow-100 text-yellow-800",
  };
}

export function MealValidationSummary({ validation }: { validation: MealValidation }) {
  const tone = getValidationTone(validation);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className={`rounded-full border px-2 py-1 font-medium ${tone.classes}`}>{tone.label}</span>
      {validation.lowItems.length > 0 ? (
        <span className="text-zinc-500">Low: {validation.lowItems.join(", ")}</span>
      ) : null}
      {validation.missingItems.length > 0 ? (
        <span className="text-zinc-500">Missing: {validation.missingItems.join(", ")}</span>
      ) : null}
    </div>
  );
}
