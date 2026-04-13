import type { StorageLayout } from "@/lib/fridge/types";
import type { InventoryDraft } from "@/lib/appState";
import type { InventoryCategory, InventoryUnit } from "@/lib/inventory/types";

export type PresetId = "scarce" | "fridge-heavy" | "pantry-heavy" | "well-stocked";

export const PRESET_METADATA: Record<PresetId, { label: string; description: string }> = {
  scarce: {
    label: "Scarce",
    description: "Bare minimum — a few fresh veggies, eggs and basic dry staples.",
  },
  "fridge-heavy": {
    label: "Fridge-heavy",
    description: "Well-stocked fridge with dairy, eggs and fresh produce, light pantry.",
  },
  "pantry-heavy": {
    label: "Pantry-heavy",
    description: "Full pantry of dry goods, grains and spices; minimal fridge items.",
  },
  "well-stocked": {
    label: "Well-stocked",
    description: "A fully-loaded Indian household kitchen — ready to cook anything.",
  },
};

type PresetItem = {
  name: string;
  quantity: number;
  unit: InventoryUnit;
  category: InventoryCategory;
  target: "fridge" | "pantry";
};

const PRESETS: Record<PresetId, PresetItem[]> = {
  scarce: [
    { name: "Onions", quantity: 4, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Tomatoes", quantity: 3, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Eggs", quantity: 6, unit: "count", category: "protein", target: "fridge" },
    { name: "Yogurt", quantity: 200, unit: "g", category: "dairy", target: "fridge" },
    { name: "Rice", quantity: 500, unit: "g", category: "grain", target: "pantry" },
    { name: "Lentils", quantity: 200, unit: "g", category: "protein", target: "pantry" },
    { name: "Salt", quantity: 100, unit: "g", category: "condiment", target: "pantry" },
    { name: "Turmeric", quantity: 50, unit: "g", category: "spice", target: "pantry" },
  ],

  "fridge-heavy": [
    { name: "Milk", quantity: 500, unit: "ml", category: "dairy", target: "fridge" },
    { name: "Yogurt", quantity: 400, unit: "g", category: "dairy", target: "fridge" },
    { name: "Paneer", quantity: 200, unit: "g", category: "dairy", target: "fridge" },
    { name: "Butter", quantity: 100, unit: "g", category: "dairy", target: "fridge" },
    { name: "Eggs", quantity: 6, unit: "count", category: "protein", target: "fridge" },
    { name: "Spinach", quantity: 200, unit: "g", category: "vegetable", target: "fridge" },
    { name: "Tomatoes", quantity: 5, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Onions", quantity: 4, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Bell Pepper", quantity: 2, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Carrot", quantity: 3, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Lemon", quantity: 2, unit: "count", category: "fruit", target: "fridge" },
    { name: "Rice", quantity: 500, unit: "g", category: "grain", target: "pantry" },
    { name: "Lentils", quantity: 300, unit: "g", category: "protein", target: "pantry" },
    { name: "Oil", quantity: 500, unit: "ml", category: "condiment", target: "pantry" },
    { name: "Salt", quantity: 200, unit: "g", category: "condiment", target: "pantry" },
  ],

  "pantry-heavy": [
    { name: "Onions", quantity: 4, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Tomatoes", quantity: 3, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Yogurt", quantity: 200, unit: "g", category: "dairy", target: "fridge" },
    { name: "Ginger", quantity: 100, unit: "g", category: "vegetable", target: "fridge" },
    { name: "Rice", quantity: 2000, unit: "g", category: "grain", target: "pantry" },
    { name: "Wheat Flour", quantity: 1000, unit: "g", category: "grain", target: "pantry" },
    { name: "Lentils", quantity: 500, unit: "g", category: "protein", target: "pantry" },
    { name: "Chickpeas", quantity: 300, unit: "g", category: "protein", target: "pantry" },
    { name: "Kidney Beans", quantity: 200, unit: "g", category: "protein", target: "pantry" },
    { name: "Oil", quantity: 1000, unit: "ml", category: "condiment", target: "pantry" },
    { name: "Salt", quantity: 500, unit: "g", category: "condiment", target: "pantry" },
    { name: "Turmeric", quantity: 50, unit: "g", category: "spice", target: "pantry" },
    { name: "Cumin", quantity: 50, unit: "g", category: "spice", target: "pantry" },
    { name: "Garam Masala", quantity: 50, unit: "g", category: "spice", target: "pantry" },
    { name: "Mustard Seeds", quantity: 50, unit: "g", category: "spice", target: "pantry" },
    { name: "Semolina", quantity: 300, unit: "g", category: "grain", target: "pantry" },
  ],

  "well-stocked": [
    { name: "Milk", quantity: 1000, unit: "ml", category: "dairy", target: "fridge" },
    { name: "Yogurt", quantity: 500, unit: "g", category: "dairy", target: "fridge" },
    { name: "Paneer", quantity: 300, unit: "g", category: "dairy", target: "fridge" },
    { name: "Butter", quantity: 200, unit: "g", category: "dairy", target: "fridge" },
    { name: "Eggs", quantity: 12, unit: "count", category: "protein", target: "fridge" },
    { name: "Spinach", quantity: 200, unit: "g", category: "vegetable", target: "fridge" },
    { name: "Tomatoes", quantity: 6, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Onions", quantity: 6, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Bell Pepper", quantity: 3, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Carrot", quantity: 4, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Lemon", quantity: 4, unit: "count", category: "fruit", target: "fridge" },
    { name: "Curry Leaves", quantity: 20, unit: "count", category: "vegetable", target: "fridge" },
    { name: "Rice", quantity: 2000, unit: "g", category: "grain", target: "pantry" },
    { name: "Wheat Flour", quantity: 1000, unit: "g", category: "grain", target: "pantry" },
    { name: "Lentils", quantity: 500, unit: "g", category: "protein", target: "pantry" },
    { name: "Chickpeas", quantity: 300, unit: "g", category: "protein", target: "pantry" },
    { name: "Kidney Beans", quantity: 200, unit: "g", category: "protein", target: "pantry" },
    { name: "Oil", quantity: 1000, unit: "ml", category: "condiment", target: "pantry" },
    { name: "Salt", quantity: 500, unit: "g", category: "condiment", target: "pantry" },
    { name: "Turmeric", quantity: 50, unit: "g", category: "spice", target: "pantry" },
    { name: "Cumin", quantity: 50, unit: "g", category: "spice", target: "pantry" },
    { name: "Garam Masala", quantity: 50, unit: "g", category: "spice", target: "pantry" },
    { name: "Mustard Seeds", quantity: 50, unit: "g", category: "spice", target: "pantry" },
    { name: "Semolina", quantity: 300, unit: "g", category: "grain", target: "pantry" },
    { name: "Poha", quantity: 300, unit: "g", category: "grain", target: "pantry" },
  ],
};

/**
 * Builds a flat list of InventoryDrafts for the given preset, assigning each
 * item to a cell via round-robin over all cells of the target storage.
 */
export function buildPresetInventory(
  presetId: PresetId,
  fridge: StorageLayout,
  pantry: StorageLayout,
): InventoryDraft[] {
  const items = PRESETS[presetId];

  type CellSlot = { storageId: string; shelfId: string; cellId: string };

  const fridgeCells: CellSlot[] = fridge.shelves.flatMap((shelf) =>
    shelf.cells.map((cell) => ({
      storageId: fridge.id,
      shelfId: shelf.id,
      cellId: cell.id,
    })),
  );

  const pantryCells: CellSlot[] = pantry.shelves.flatMap((shelf) =>
    shelf.cells.map((cell) => ({
      storageId: pantry.id,
      shelfId: shelf.id,
      cellId: cell.id,
    })),
  );

  const fridgeItems = items.filter((item) => item.target === "fridge");
  const pantryItems = items.filter((item) => item.target === "pantry");

  const toDrafts = (list: PresetItem[], pool: CellSlot[]): InventoryDraft[] =>
    pool.length === 0
      ? []
      : list.map((item, index) => {
          const slot = pool[index % pool.length];
          return {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            storageId: slot.storageId,
            shelfId: slot.shelfId,
            cellId: slot.cellId,
          };
        });

  return [...toDrafts(fridgeItems, fridgeCells), ...toDrafts(pantryItems, pantryCells)];
}
