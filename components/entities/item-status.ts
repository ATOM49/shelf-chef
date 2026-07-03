import type { IngredientMatch } from "@/lib/planner/types";

/**
 * Shared availability status for anything item-shaped — stock items,
 * recipe ingredients, and grocery cart entries all map onto this.
 */
export type ItemStatus = IngredientMatch["status"];

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  enough: "In stock",
  low: "Low stock",
  missing: "Missing",
  unit_mismatch: "Unit mismatch",
  staple: "Staple",
};

export const ITEM_STATUS_BADGE_CLASSES: Record<ItemStatus, string> = {
  enough: "border-green-200 bg-green-100 text-green-800",
  staple: "border-green-200 bg-green-50 text-green-700",
  low: "border-yellow-200 bg-yellow-100 text-yellow-800",
  unit_mismatch: "border-yellow-200 bg-yellow-50 text-yellow-800",
  missing: "border-red-200 bg-red-100 text-red-800",
};

export function formatItemQuantity(quantity: number, unit: string): string {
  const rounded = Number.isInteger(quantity) ? quantity : quantity.toFixed(1);
  return `${rounded} ${unit}`;
}
