import { createCells, createDefaultPantry, createDefaultSingleDoorFridge, createShelf, resizeShelf } from "@/lib/fridge/layout";
import type { FridgeLayout, Shelf, StorageLayout, StorageType } from "@/lib/fridge/types";
import { buildGroceryCartFromMeals } from "@/lib/grocery";
import { generateId } from "@/lib/id";
import { applyMealConsumption } from "@/lib/inventory/consumption";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { InventoryCategory, InventoryItem, InventoryUnit } from "@/lib/inventory/types";
import { buildPresetInventory, type PresetId } from "@/lib/inventory/presets";
import { generateWeeklyPlan } from "@/lib/planner/generatePlan";
import type {
  PlannedMeal,
  PlannerState,
  PreferredDishRequest,
  Recipe,
} from "@/lib/planner/types";
import { revalidatePlannedMeals, validateRecipeAgainstInventory } from "@/lib/planner/validation";
import { resolveRecipeByDishName } from "@/lib/recipes/resolve";
import { recipes as systemRecipes } from "@/data/recipes";

export type AppState = {
  fridge: FridgeLayout;
  pantry: StorageLayout;
  inventory: InventoryItem[];
  recipes: Recipe[];
  planner: PlannerState;
};

export type InventoryDraft = {
  name: string;
  quantity: number;
  unit: InventoryUnit;
  category: InventoryCategory;
  storageId: string;
  shelfId: string;
  cellId: string;
  expiresAt?: string;
};

export type StockingItemDraft = {
  name: string;
  quantity: number;
  unit: InventoryUnit;
  category: InventoryCategory;
  storageType: StorageType;
  /** Shelf to find or create by name */
  shelfName: string;
  expiresAt?: string;
};

export type AppAction =
  | { type: "ADD_SHELF"; target?: StorageType }
  | { type: "REORDER_SHELVES"; target: StorageType; activeShelfId: string; overShelfId: string }
  | { type: "REMOVE_SHELF"; shelfId: string }
  | { type: "UPDATE_SHELF"; shelfId: string; patch: Partial<AppState["fridge"]["shelves"][number]> }
  | { type: "RESIZE_SHELF"; shelfId: string; rows: number; cols: number }
  | { type: "UPDATE_FRIDGE_NAME"; name: string }
  | { type: "UPDATE_STORAGE_NAME"; target: StorageType; name: string }
  | { type: "RESET_APP" }
  | { type: "ADD_INVENTORY_ITEM"; item: InventoryDraft }
  | { type: "UPDATE_INVENTORY_ITEM"; itemId: string; patch: Partial<InventoryDraft> }
  | { type: "REMOVE_INVENTORY_ITEM"; itemId: string }
  | { type: "SET_PREFERENCES"; preferences: string }
  | { type: "ADD_PREFERRED_DISH"; name: string; mealType?: PreferredDishRequest["mealType"] }
  | { type: "REMOVE_PREFERRED_DISH"; dishId: string }
  | { type: "ADD_CUSTOM_RECIPE"; recipe: Recipe }
  | { type: "GENERATE_WEEKLY_PLAN" }
  | { type: "REPLACE_PLANNED_MEAL"; mealId: string; recipeName: string }
  | { type: "SELECT_MEAL"; mealId?: string }
  | { type: "SET_MEAL_COOKED"; mealId: string; cooked: boolean }
  | { type: "MOVE_PLANNED_MEAL_SLOT"; mealId: string; day: string; mealType: PlannedMeal["mealType"] }
  | { type: "TOGGLE_GROCERY_ITEM"; itemId: string }
  | { type: "SEED_INVENTORY"; preset: PresetId }
  | { type: "STOCK_ITEMS"; items: StockingItemDraft[] };

export function createInventoryItem(item: InventoryDraft): InventoryItem {
  return {
    id: generateId(),
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
    pantry: createDefaultPantry(),
    inventory: [],
    recipes: [...systemRecipes],
    planner: {
      preferences: "",
      preferredDishes: [],
      weeklyPlan: [],
      groceryCart: [],
      selectedMealId: undefined,
    },
  };
}

function updateShelfInStorage(
  state: AppState,
  shelfId: string,
  updater: (shelf: AppState["fridge"]["shelves"][number]) => AppState["fridge"]["shelves"][number],
): AppState {
  if (state.fridge.shelves.some((s) => s.id === shelfId)) {
    return {
      ...state,
      fridge: {
        ...state.fridge,
        shelves: state.fridge.shelves.map((s) => (s.id === shelfId ? updater(s) : s)),
      },
    };
  }
  return {
    ...state,
    pantry: {
      ...state.pantry,
      shelves: state.pantry.shelves.map((s) => (s.id === shelfId ? updater(s) : s)),
    },
  };
}

function reorderShelves<T extends { id: string }>(
  shelves: T[],
  activeShelfId: string,
  overShelfId: string,
): T[] {
  const activeIndex = shelves.findIndex((shelf) => shelf.id === activeShelfId);
  const overIndex = shelves.findIndex((shelf) => shelf.id === overShelfId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return shelves;
  }

  const nextShelves = [...shelves];
  const [movedShelf] = nextShelves.splice(activeIndex, 1);
  nextShelves.splice(overIndex, 0, movedShelf);
  return nextShelves;
}

function selectFirstPlannedMeal(meals: PlannedMeal[]) {
  return meals[0]?.id;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_SHELF": {
      const target = action.target ?? "fridge";
      const storage = target === "pantry" ? state.pantry : state.fridge;
      const shelfNumber = storage.shelves.length + 1;
      const newShelf = {
        id: generateId(),
        name: `Shelf ${shelfNumber}`,
        rows: 1,
        cols: 3,
        height: 120,
        cells: createCells(1, 3),
      };
      if (target === "pantry") {
        return { ...state, pantry: { ...state.pantry, shelves: [...state.pantry.shelves, newShelf] } };
      }
      return { ...state, fridge: { ...state.fridge, shelves: [...state.fridge.shelves, newShelf] } };
    }

    case "REORDER_SHELVES": {
      const storage = action.target === "pantry" ? state.pantry : state.fridge;
      const nextShelves = reorderShelves(storage.shelves, action.activeShelfId, action.overShelfId);

      if (nextShelves === storage.shelves) {
        return state;
      }

      if (action.target === "pantry") {
        return {
          ...state,
          pantry: {
            ...state.pantry,
            shelves: nextShelves,
          },
        };
      }

      return {
        ...state,
        fridge: {
          ...state.fridge,
          shelves: nextShelves,
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
        pantry: {
          ...state.pantry,
          shelves: state.pantry.shelves.filter((shelf) => shelf.id !== action.shelfId),
        },
        inventory: state.inventory.filter((item) => item.shelfId !== action.shelfId),
      };
    }

    case "UPDATE_SHELF": {
      return updateShelfInStorage(state, action.shelfId, (shelf) => ({ ...shelf, ...action.patch }));
    }

    case "RESIZE_SHELF": {
      const allShelves = [...state.fridge.shelves, ...state.pantry.shelves];
      const currentShelf = allShelves.find((shelf) => shelf.id === action.shelfId);
      if (!currentShelf) return state;

      const resizedShelf = resizeShelf(currentShelf, action.rows, action.cols);
      const validCellIds = new Set(resizedShelf.cells.map((cell) => cell.id));
      const fallbackCellId = resizedShelf.cells[0]?.id;

      const afterResize = updateShelfInStorage(state, action.shelfId, () => resizedShelf);
      return {
        ...afterResize,
        inventory: state.inventory.map((item) => {
          if (item.shelfId !== action.shelfId || validCellIds.has(item.cellId) || !fallbackCellId) {
            return item;
          }
          return { ...item, cellId: fallbackCellId };
        }),
      };
    }

    case "UPDATE_FRIDGE_NAME": {
      return { ...state, fridge: { ...state.fridge, name: action.name } };
    }

    case "UPDATE_STORAGE_NAME": {
      if (action.target === "pantry") {
        return { ...state, pantry: { ...state.pantry, name: action.name } };
      }
      return { ...state, fridge: { ...state.fridge, name: action.name } };
    }

    case "RESET_APP": {
      return createDefaultAppState();
    }

    case "SEED_INVENTORY": {
      const drafts = buildPresetInventory(action.preset, state.fridge, state.pantry);
      return {
        ...state,
        inventory: drafts.map(createInventoryItem),
      };
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

    case "ADD_PREFERRED_DISH": {
      const resolved = resolveRecipeByDishName(action.name, state.recipes);
      const dish: PreferredDishRequest = {
        id: generateId(),
        name: action.name.trim(),
        mealType: action.mealType,
        status: resolved ? "resolved" : "failed",
        resolvedRecipeId: resolved?.id,
      };
      return {
        ...state,
        planner: {
          ...state.planner,
          preferredDishes: [...state.planner.preferredDishes, dish],
        },
      };
    }

    case "REMOVE_PREFERRED_DISH": {
      return {
        ...state,
        planner: {
          ...state.planner,
          preferredDishes: state.planner.preferredDishes.filter((d) => d.id !== action.dishId),
        },
      };
    }

    case "ADD_CUSTOM_RECIPE": {
      return {
        ...state,
        recipes: [...state.recipes, action.recipe],
      };
    }

    case "GENERATE_WEEKLY_PLAN": {
      const { meals, groceryCart } = generateWeeklyPlan({
        inventory: state.inventory,
        preferences: state.planner.preferences,
        recipes: state.recipes,
        preferredDishes: state.planner.preferredDishes,
      });

      return {
        ...state,
        planner: {
          ...state.planner,
          weeklyPlan: meals,
          groceryCart,
          selectedMealId: selectFirstPlannedMeal(meals),
        },
      };
    }

    case "REPLACE_PLANNED_MEAL": {
      const resolved = resolveRecipeByDishName(action.recipeName, state.recipes);
      if (!resolved) return state;

      const validation = validateRecipeAgainstInventory(resolved, state.inventory);
      const nextPlan = state.planner.weeklyPlan.map((meal) =>
        meal.id === action.mealId
          ? { ...meal, recipe: resolved, validation }
          : meal,
      );
      const groceryCart = buildGroceryCartFromMeals(nextPlan, state.inventory);

      return {
        ...state,
        planner: {
          ...state.planner,
          weeklyPlan: nextPlan,
          groceryCart,
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

    case "SET_MEAL_COOKED": {
      if (!action.cooked) {
        // Un-cooking is intentionally unsupported because completing a meal mutates inventory.
        return state;
      }

      const meal = state.planner.weeklyPlan.find((plannedMeal) => plannedMeal.id === action.mealId);
      if (!meal || meal.status === "completed" || !meal.validation.canCook) {
        return state;
      }

      const nextInventory = applyMealConsumption(state.inventory, meal);
      const nextPlan = revalidatePlannedMeals(
        state.planner.weeklyPlan.map((plannedMeal) =>
          plannedMeal.id === action.mealId
            ? { ...plannedMeal, status: "completed" as const }
            : plannedMeal,
        ),
        nextInventory,
      );
      const groceryCart = buildGroceryCartFromMeals(nextPlan, nextInventory);

      return {
        ...state,
        inventory: nextInventory,
        planner: {
          ...state.planner,
          weeklyPlan: nextPlan,
          groceryCart,
        },
      };
    }

    case "MOVE_PLANNED_MEAL_SLOT": {
      const activeMeal = state.planner.weeklyPlan.find((plannedMeal) => plannedMeal.id === action.mealId);
      if (!activeMeal || activeMeal.mealType !== action.mealType || activeMeal.day === action.day) {
        return state;
      }

      const targetMeal = state.planner.weeklyPlan.find(
        (plannedMeal) =>
          plannedMeal.id !== action.mealId &&
          plannedMeal.day === action.day &&
          plannedMeal.mealType === action.mealType,
      );

      const nextPlan = state.planner.weeklyPlan.map((plannedMeal) => {
        if (plannedMeal.id === action.mealId) {
          return { ...plannedMeal, day: action.day };
        }
        if (targetMeal && plannedMeal.id === targetMeal.id) {
          return { ...plannedMeal, day: activeMeal.day };
        }
        return plannedMeal;
      });

      return {
        ...state,
        planner: {
          ...state.planner,
          weeklyPlan: nextPlan,
        },
      };
    }

    case "TOGGLE_GROCERY_ITEM": {
      return {
        ...state,
        planner: {
          ...state.planner,
          groceryCart: state.planner.groceryCart.map((item) =>
            item.id === action.itemId ? { ...item, checked: !item.checked } : item,
          ),
        },
      };
    }

    case "STOCK_ITEMS": {
      return applyStockItems(state, action.items);
    }

    default:
      return state;
  }
}

/**
 * Finds or creates a shelf by name within a storage layout, returning both the
 * (possibly updated) layout and the resolved shelf.
 */
function findOrCreateShelf(
  storage: StorageLayout,
  shelfName: string,
): { storage: StorageLayout; shelf: Shelf } {
  const existing = storage.shelves.find(
    (s) => s.name.toLowerCase() === shelfName.toLowerCase(),
  );
  if (existing) {
    return { storage, shelf: existing };
  }
  const newShelf = createShelf(shelfName, 1, 3, 120);
  return {
    storage: { ...storage, shelves: [...storage.shelves, newShelf] },
    shelf: newShelf,
  };
}

/**
 * Applies a batch of StockingItemDrafts to the state, creating shelves as
 * needed and assigning items to cells via round-robin.
 */
function applyStockItems(state: AppState, items: StockingItemDraft[]): AppState {
  let nextFridge = state.fridge;
  let nextPantry = state.pantry;
  const newInventoryItems: InventoryItem[] = [];

  // Group items by storageType + shelfName so we can batch shelf lookups
  const groups = new Map<string, { storageType: StorageType; shelfName: string; items: StockingItemDraft[] }>();
  for (const item of items) {
    const key = `${item.storageType}:${item.shelfName.toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, { storageType: item.storageType, shelfName: item.shelfName, items: [] });
    }
    groups.get(key)!.items.push(item);
  }

  for (const group of groups.values()) {
    const storage = group.storageType === "fridge" ? nextFridge : nextPantry;
    const { storage: updatedStorage, shelf } = findOrCreateShelf(storage, group.shelfName);

    if (group.storageType === "fridge") {
      nextFridge = updatedStorage as FridgeLayout;
    } else {
      nextPantry = updatedStorage;
    }

    const cells = shelf.cells.length > 0 ? shelf.cells : [{ id: "cell-0-0", row: 0, col: 0 }];
    group.items.forEach((item, index) => {
      const cellId = cells[index % cells.length].id;
      newInventoryItems.push(
        createInventoryItem({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          storageId: updatedStorage.id,
          shelfId: shelf.id,
          cellId,
          expiresAt: item.expiresAt,
        }),
      );
    });
  }

  return {
    ...state,
    fridge: nextFridge,
    pantry: nextPantry,
    inventory: [...state.inventory, ...newInventoryItems],
  };
}
