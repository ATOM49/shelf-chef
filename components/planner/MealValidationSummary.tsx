"use client";

import { CircleAlert } from "lucide-react";

import { ItemBadge } from "@/components/entities/ItemBadge";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

/**
 * Compact availability callout for recipe cards — a single alert icon that
 * flags missing/low ingredients, mirroring the low-stock indicator on shelf
 * items. Cookable recipes render nothing; the gap items live in the tooltip
 * rather than being listed on the card.
 */
export function MealValidationIndicator({
  validation,
  className,
}: {
  validation: MealValidation;
  className?: string;
}) {
  if (validation.canCook) return null;

  const hasMissing = validation.missingItems.length > 0;
  const items = hasMissing ? validation.missingItems : validation.lowItems;
  const label = hasMissing ? "Missing ingredients" : "Running low";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          aria-label={`${label}: ${items.join(", ")}`}
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-white shadow-sm ring-1",
            hasMissing
              ? "bg-red-500 ring-red-600/20"
              : "bg-amber-500 ring-amber-600/20",
            className,
          )}
        >
          <CircleAlert className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{label}</span>
            <span className="opacity-90">{items.join(", ")}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
