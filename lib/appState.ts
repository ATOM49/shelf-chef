import { createDefaultSingleDoorFridge, resizeShelf } from "@/lib/fridge/layout";
import type { FridgeLayout } from "@/lib/fridge/types";
import { applyMealConsumption } from "@/lib/inventory/consumption";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { InventoryCategory, InventoryItem, InventoryUnit } from "@/lib/inventory/types";
import { generateWeeklyDinnerPlan } from "@/lib/planner/generatePlan";
import type { PlannedMeal, PlannerState } from "@/lib/planner/types";
import { validateRecipeAgainstInventory } from "@/lib/planner/validation";
import { recipes } from "@/data/recipes";

export type AppState = {
  fridge: FridgeLayout;
  inventory: InventoryItem[];
  planner: PlannerState;
};

export type InventoryDraft = {
  name: string;
  quantity: number;
  unit: InventoryUnit;
  category: InventoryCategory;
  shelfId: string;
  cellId: string;
  expiresAt?: string;
};

export type AppAction =
  | { type: "ADD_SHELF" }
  | { type: "REMOVE_SHELF"; shelfId: string }
  | { type: "UPDATE_SHELF"; shelfId: string; patch: Partial<AppState["fridge"]["shelves"][number]> }
  | { type: "RESIZE_SHELF"; shelfId: string; rows: number; cols: number }
  | { type: "UPDATE_FRIDGE_NAME"; name: string }
  | { type: "RESET_APP" }
  | { type: "ADD_INVENTORY_ITEM"; item: InventoryDraft }
  | { type: "UPDATE_INVENTORY_ITEM"; itemId: string; patch: Partial<InventoryDraft> }
  | { type: "REMOVE_INVENTORY_ITEM"; itemId: string }
  | { type: "SET_PREFERENCES"; preferences: string }
  | { type: "GENERATE_WEEKLY_PLAN" }
  | { type: "SELECT_MEAL"; mealId?: string }
  | { type: "COMPLETE_MEAL"; mealId: string };

export function createInventoryItem(item: InventoryDraft): InventoryItem {
  return {
    id: crypto.randomUUID(),
    ...item,
    name: item.name.trim(),
    normalizedName: normalizeIngredientName(item.name),
    expiresAt: item.expiresAt || undefined,
  };
}

function patchInventoryItem(item: InventoryItem, patch: Partial<InventoryDraft>): InventoryItem {
  const nextName = patch.name ?? item.name;

  return {
    ...item,
    ...patch,
    name: nextName.trim(),
    normalizedName: normalizeIngredientName(nextName),
    expiresAt: patch.expiresAt || undefined,
  };
}

export function createDefaultAppState(): AppState {
  return {
    fridge: createDefaultSingleDoorFridge(),
    inventory: [],
    planner: {
      preferences: "",
      weeklyPlan: [],
      selectedMealId: undefined,
    },
  };
}

function selectFirstPlannedMeal(meals: PlannedMeal[]) {
  return meals[0]?.id;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_SHELF": {
      const shelfNumber = state.fridge.shelves.length + 1;
      return {
        ...state,
        fridge: {
          ...state.fridge,
          shelves: [
            ...state.fridge.shelves,
            {
              id: crypto.randomUUID(),
              name: `Shelf ${shelfNumber}`,
              rows: 1,
              cols: 3,
              height: 120,
              cells: Array.from({ length: 3 }, (_, col) => ({ id: `cell-0-${col}`, row: 0, col })),
            },
          ],
        },
      };
    }

    case "REMOVE_SHELF": {
      return {
        ...state,
        fridge: {
          ...state.fridge,
          shelves: state.fridge.shelves.filter((shelf) => shelf.id !== action.shelfId),
        },
        inventory: state.inventory.filter((item) => item.shelfId !== action.shelfId),
      };
    }

    case "UPDATE_SHELF": {
      return {
        ...state,
        fridge: {
          ...state.fridge,
          shelves: state.fridge.shelves.map((shelf) =>
            shelf.id === action.shelfId ? { ...shelf, ...action.patch } : shelf,
          ),
        },
      };
    }

    case "RESIZE_SHELF": {
      const currentShelf = state.fridge.shelves.find((shelf) => shelf.id === action.shelfId);
      if (!currentShelf) return state;

      const resizedShelf = resizeShelf(currentShelf, action.rows, action.cols);
      const validCellIds = new Set(resizedShelf.cells.map((cell) => cell.id));
      const fallbackCellId = resizedShelf.cells[0]?.id;

      return {
        ...state,
        fridge: {
          ...state.fridge,
          shelves: state.fridge.shelves.map((shelf) =>
            shelf.id === action.shelfId ? resizedShelf : shelf,
          ),
        },
        inventory: state.inventory.map((item) => {
          if (item.shelfId !== action.shelfId || validCellIds.has(item.cellId) || !fallbackCellId) {
            return item;
          }

          return { ...item, cellId: fallbackCellId };
        }),
      };
    }

    case "UPDATE_FRIDGE_NAME": {
      return {
        ...state,
        fridge: {
          ...state.fridge,
          name: action.name,
        },
      };
    }

    case "RESET_APP": {
      return createDefaultAppState();
    }

    case "ADD_INVENTORY_ITEM": {
      return {
        ...state,
        inventory: [...state.inventory, createInventoryItem(action.item)],
      };
    }

    case "UPDATE_INVENTORY_ITEM": {
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.id === action.itemId ? patchInventoryItem(item, action.patch) : item,
        ),
      };
    }

    case "REMOVE_INVENTORY_ITEM": {
      return {
        ...state,
        inventory: state.inventory.filter((item) => item.id !== action.itemId),
      };
    }

    case "SET_PREFERENCES": {
      return {
        ...state,
        planner: {
          ...state.planner,
          preferences: action.preferences,
        },
      };
    }

    case "GENERATE_WEEKLY_PLAN": {
      const weeklyPlan = generateWeeklyDinnerPlan({
        inventory: state.inventory,
        preferences: state.planner.preferences,
        recipes,
      });

      return {
        ...state,
        planner: {
          ...state.planner,
          weeklyPlan,
          selectedMealId: selectFirstPlannedMeal(weeklyPlan),
        },
      };
    }

    case "SELECT_MEAL": {
      return {
        ...state,
        planner: {
          ...state.planner,
          selectedMealId: action.mealId,
        },
      };
    }

    case "COMPLETE_MEAL": {
      const meal = state.planner.weeklyPlan.find((plannedMeal) => plannedMeal.id === action.mealId);
      if (!meal || meal.status === "completed" || !meal.validation.canCook) {
        return state;
      }

      const nextInventory = applyMealConsumption(state.inventory, meal);

      return {
        ...state,
        inventory: nextInventory,
        planner: {
          ...state.planner,
          weeklyPlan: state.planner.weeklyPlan.map((plannedMeal) =>
            plannedMeal.id === action.mealId
              ? { ...plannedMeal, status: "completed" }
              : {
                  ...plannedMeal,
                  validation: validateRecipeAgainstInventory(plannedMeal.recipe, nextInventory),
                },
          ),
        },
      };
    }

    default:
      return state;
  }
}
