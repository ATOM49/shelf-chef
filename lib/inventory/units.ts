import type { InventoryUnit } from "@/lib/inventory/types";

export type UnitGroup = "count" | "weight" | "volume";

export const unitMeta: Record<InventoryUnit, { group: UnitGroup; factor: number }> = {
  count: { group: "count", factor: 1 },
  g: { group: "weight", factor: 1 },
  kg: { group: "weight", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  l: { group: "volume", factor: 1000 },
};

export function isSupportedUnit(value: string): value is InventoryUnit {
  return value in unitMeta;
}

export function convertQuantity(quantity: number, fromUnit: InventoryUnit, toUnit: InventoryUnit) {
  const from = unitMeta[fromUnit];
  const to = unitMeta[toUnit];

  if (from.group !== to.group) {
    return null;
  }

  return (quantity * from.factor) / to.factor;
}
