import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { InventoryUnit } from "@/lib/inventory/types";

export type UnitGroup = "count" | "weight" | "volume";
export type BaseInventoryUnit = "count" | "g" | "ml";
export type QuantityConversionMethod = "direct" | "heuristic";
export type InventoryUnitHint = {
  normalizedName: string;
  displayName: string;
  units: InventoryUnit[];
  preferredUnit?: InventoryUnit;
};

export const unitMeta: Record<InventoryUnit, { group: UnitGroup; factor: number }> = {
  count: { group: "count", factor: 1 },
  g: { group: "weight", factor: 1 },
  kg: { group: "weight", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  l: { group: "volume", factor: 1000 },
  tbsp: { group: "volume", factor: 15 },
  tsp: { group: "volume", factor: 5 },
  cup: { group: "volume", factor: 240 },
};

const HEURISTIC_DENSITY_GRAMS_PER_ML: Record<string, number> = {
  butter: 0.96,
  cheese: 0.5,
  chickpea: 0.76,
  "garam masala": 0.42,
  "kidney bean": 0.75,
  lentil: 0.78,
  milk: 1.03,
  "mustard seed": 0.61,
  oil: 0.92,
  paneer: 1.04,
  pasta: 0.42,
  poha: 0.14,
  rice: 0.79,
  semolina: 0.67,
  yogurt: 1.03,
};

export function isSupportedUnit(value: string): value is InventoryUnit {
  return value in unitMeta;
}

export function getUnitGroup(unit: InventoryUnit): UnitGroup {
  return unitMeta[unit].group;
}

export function getCanonicalUnitForGroup(group: UnitGroup): BaseInventoryUnit {
  if (group === "weight") return "g";
  if (group === "volume") return "ml";
  return "count";
}

export function buildInventoryUnitHints(
  inventory: Array<{ name: string; normalizedName?: string; unit: InventoryUnit }>,
): InventoryUnitHint[] {
  const hints = new Map<string, InventoryUnitHint>();

  for (const item of inventory) {
    const normalizedName = normalizeIngredientName(item.normalizedName || item.name);
    if (!normalizedName) {
      continue;
    }

    const existing = hints.get(normalizedName);
    if (!existing) {
      hints.set(normalizedName, {
        normalizedName,
        displayName: item.name.trim() || normalizedName,
        units: [item.unit],
        preferredUnit: item.unit,
      });
      continue;
    }

    if (!existing.units.includes(item.unit)) {
      existing.units.push(item.unit);
    }

    if (existing.units.length > 1) {
      existing.preferredUnit = undefined;
    }
  }

  return Array.from(hints.values()).sort((left, right) =>
    left.normalizedName.localeCompare(right.normalizedName, "en-US"),
  );
}

export function toBaseUnit(
  quantity: number,
  unit: InventoryUnit,
): { baseQuantity: number; baseUnit: BaseInventoryUnit } {
  const baseUnit = getCanonicalUnitForGroup(getUnitGroup(unit));
  if (baseUnit === unit) {
    return { baseQuantity: quantity, baseUnit };
  }

  return {
    baseQuantity: (quantity * unitMeta[unit].factor) / unitMeta[baseUnit].factor,
    baseUnit,
  };
}

export function convertQuantityDetailed(
  quantity: number,
  fromUnit: InventoryUnit,
  toUnit: InventoryUnit,
  normalizedIngredientName?: string,
): { quantity: number; method: QuantityConversionMethod } | null {
  const from = unitMeta[fromUnit];
  const to = unitMeta[toUnit];

  if (from.group === to.group) {
    return {
      quantity: (quantity * from.factor) / to.factor,
      method: "direct",
    };
  }

  if (from.group === "count" || to.group === "count") {
    return null;
  }

  const gramsPerMl =
    normalizedIngredientName == null
      ? undefined
      : HEURISTIC_DENSITY_GRAMS_PER_ML[normalizedIngredientName];
  if (gramsPerMl == null) {
    return null;
  }

  const fromBase = toBaseUnit(quantity, fromUnit);
  const heuristicBaseQuantity =
    from.group === "weight"
      ? fromBase.baseQuantity / gramsPerMl
      : fromBase.baseQuantity * gramsPerMl;
  const heuristicBaseUnit: BaseInventoryUnit = from.group === "weight" ? "ml" : "g";

  return {
    quantity: (heuristicBaseQuantity * unitMeta[heuristicBaseUnit].factor) / unitMeta[toUnit].factor,
    method: "heuristic",
  };
}

export function convertQuantity(
  quantity: number,
  fromUnit: InventoryUnit,
  toUnit: InventoryUnit,
  normalizedIngredientName?: string,
) {
  return convertQuantityDetailed(quantity, fromUnit, toUnit, normalizedIngredientName)?.quantity ?? null;
}
