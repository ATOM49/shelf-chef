"use client";

import { CookingPot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RecipeMealType } from "@/lib/planner/types";

type RecipeBadgeProps = {
  title: string;
  mealType?: RecipeMealType;
  variant?: "outline" | "secondary";
  className?: string;
};

/**
 * Badge-view of a recipe. Used wherever a recipe is referenced inline
 * (tooltips, chips) — only needs a title, so it also works for contexts that
 * carry recipe titles without the full object (e.g. the grocery cart).
 */
export function RecipeBadge({
  title,
  mealType,
  variant = "secondary",
  className,
}: RecipeBadgeProps) {
  return (
    <Badge variant={variant} className={cn("max-w-full", className)} title={title}>
      <CookingPot aria-hidden />
      <span className="truncate">{title}</span>
      {mealType ? (
        <span className="font-normal capitalize opacity-75">{mealType}</span>
      ) : null}
    </Badge>
  );
}
