"use client";

import { ItemBadge } from "@/components/entities/ItemBadge";
import { Badge } from "@/components/ui/badge";
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

export function MealValidationSummary({
  validation,
  maxItems,
}: {
  validation: MealValidation;
  /** Caps how many missing/low item badges show; the rest collapse to +N. */
  maxItems?: number;
}) {
  const tone = getValidationTone(validation);
  const gaps = [
    ...validation.missingItems.map((name) => ({ name, status: "missing" as const })),
    ...validation.lowItems.map((name) => ({ name, status: "low" as const })),
  ];
  const visibleGaps = typeof maxItems === "number" ? gaps.slice(0, maxItems) : gaps;
  const hiddenCount = gaps.length - visibleGaps.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className={tone.classes}>
        {tone.label}
      </Badge>
      {visibleGaps.map((gap) => (
        <ItemBadge key={`${gap.status}-${gap.name}`} name={gap.name} status={gap.status} />
      ))}
      {hiddenCount > 0 ? <Badge variant="ghost">+{hiddenCount} more</Badge> : null}
    </div>
  );
}
