export const INVENTORY_UNITS = ["count", "g", "kg", "ml", "l", "tbsp", "tsp", "cup"] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const INVENTORY_CATEGORIES = [
  "vegetable",
  "fruit",
  "dairy",
  "protein",
  "grain",
  "condiment",
  "spice",
  "other",
] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export type InventoryItem = {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: InventoryUnit;
  category: InventoryCategory;
  shelfId: string;
  cellId: string;
  expiresAt?: string;
};

export const CATEGORY_COLORS: Record<InventoryCategory, string> = {
  vegetable: "bg-green-100 text-green-800 border-green-200",
  fruit: "bg-orange-100 text-orange-800 border-orange-200",
  dairy: "bg-yellow-100 text-yellow-800 border-yellow-200",
  protein: "bg-red-100 text-red-800 border-red-200",
  grain: "bg-amber-100 text-amber-800 border-amber-200",
  condiment: "bg-purple-100 text-purple-800 border-purple-200",
  spice: "bg-pink-100 text-pink-800 border-pink-200",
  other: "bg-zinc-100 text-zinc-700 border-zinc-200",
};
