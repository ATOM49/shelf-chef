import { createCells, createDefaultSingleDoorFridge, resizeShelf } from "@/lib/fridge/layout";
import type { FridgeLayout } from "@/lib/fridge/types";
import { buildGroceryCartFromMeals } from "@/lib/grocery";
import { generateId } from "@/lib/id";
import { applyMealConsumption } from "@/lib/inventory/consumption";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { InventoryCategory, InventoryItem, InventoryUnit } from "@/lib/inventory/types";
import { generateWeeklyPlan } from "@/lib/planner/generatePlan";
import type {
  GroceryCartItem,
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
  inventory: InventoryItem[];
  recipes: Recipe[];
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
  | { type: "ADD_PREFERRED_DISH"; name: string; mealType?: PreferredDishRequest["mealType"] }
  | { type: "REMOVE_PREFERRED_DISH"; dishId: string }
  | { type: "ADD_CUSTOM_RECIPE"; recipe: Recipe }
  | { type: "GENERATE_WEEKLY_PLAN" }
  | { type: "REPLACE_PLANNED_MEAL"; mealId: string; recipeName: string }
  | { type: "SELECT_MEAL"; mealId?: string }
  | { type: "COMPLETE_MEAL"; mealId: string }
  | { type: "TOGGLE_GROCERY_ITEM"; itemId: string };

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
              id: generateId(),
              name: `Shelf ${shelfNumber}`,
              rows: 1,
              cols: 3,
              height: 120,
              cells: createCells(1, 3),
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

    case "COMPLETE_MEAL": {
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

    default:
      return state;
  }
}
