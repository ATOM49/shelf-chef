import { createCells, createEmptyFridge, createEmptyPantry, createShelf, resizeShelf } from "@/lib/fridge/layout";
import type { FridgeLayout, Shelf, StorageLayout, StorageType } from "@/lib/fridge/types";
import { buildGroceryCartFromMeals } from "@/lib/grocery";
import { generateId } from "@/lib/id";
import { applyMealConsumption } from "@/lib/inventory/consumption";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { InventoryCategory, InventoryItem, InventoryUnit } from "@/lib/inventory/types";
import { convertQuantity } from "@/lib/inventory/units";
import { buildGeneratedWeeklyPlan } from "@/lib/planner/generatePlan";
import type {
  PlannedMeal,
  PlannedMealType,
  PlannerConfigSnapshot,
  PlannerMealSlot,
  PlannerPreferredDishInput,
  PlannerState,
  PreferredDishRequest,
  Recipe,
} from "@/lib/planner/types";
import { revalidatePlannedMeals, validateRecipeAgainstInventory } from "@/lib/planner/validation";
import { resolveRecipeByDishName } from "@/lib/recipes/resolve";

export type AppState = {
  fridge: FridgeLayout;
  pantry: StorageLayout;
  inventory: InventoryItem[];
  recipes: Recipe[];
  planner: PlannerState;
};

export type InventoryDraft = {
  emoji?: string;
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
  emoji?: string;
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
  | {
      type: "SET_PREFERRED_DISHES";
      preferredDishes: Array<Pick<PreferredDishRequest, "id" | "name" | "mealType">>;
    }
  | { type: "REMOVE_PREFERRED_DISH"; dishId: string }
  | { type: "ADD_CUSTOM_RECIPE"; recipe: Recipe }
  | { type: "REMOVE_CUSTOM_RECIPE"; recipeId: string }
  | { type: "APPLY_GENERATED_PLAN"; recipes: Recipe[]; mealSlots: PlannerMealSlot[] }
  | { type: "CLEAR_WEEKLY_PLAN" }
  | { type: "REPLACE_PLANNED_MEAL"; mealId: string; recipeId: string }
  | { type: "SELECT_MEAL"; mealId?: string }
  | { type: "SET_MEAL_COOKED"; mealId: string; cooked: boolean }
  | { type: "MOVE_PLANNED_MEAL_SLOT"; mealId: string; day: string; mealType: PlannedMeal["mealType"] }
  | { type: "REMOVE_PLANNED_MEAL"; mealId: string }
  | { type: "ADD_MEAL_TO_SLOT"; day: string; mealType: PlannedMealType; recipeId: string }
  | { type: "TOGGLE_GROCERY_ITEM"; itemId: string }
  | { type: "STOCK_ITEMS"; items: StockingItemDraft[] }
  | { type: "LOAD_STATE"; state: AppState };

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
    fridge: createEmptyFridge(),
    pantry: createEmptyPantry(),
    inventory: [],
    recipes: [],
    planner: {
      preferences: "",
      preferredDishes: [],
      weeklyPlan: [],
      groceryCart: [],
      selectedMealId: undefined,
      lastGeneratedConfig: undefined,
    },
  };
}

function normalizePlannerPreferenceText(preferences: string) {
  return preferences.trim().replace(/\s+/g, " ");
}

function toPlannerPreferredDishInput(
  preferredDishes: Array<Pick<PreferredDishRequest, "name" | "mealType">>,
): PlannerPreferredDishInput[] {
  return preferredDishes.map((dish) => ({
    name: dish.name.trim(),
    mealType: dish.mealType,
  }));
}

export function createPlannerConfigSnapshot(
  planner: {
    preferences: string;
    preferredDishes: Array<Pick<PreferredDishRequest, "name" | "mealType">>;
  },
): PlannerConfigSnapshot {
  return {
    preferences: normalizePlannerPreferenceText(planner.preferences),
    preferredDishes: toPlannerPreferredDishInput(planner.preferredDishes),
  };
}

export function arePlannerConfigsEqual(
  left?: PlannerConfigSnapshot,
  right?: PlannerConfigSnapshot,
) {
  if (!left || !right) {
    return false;
  }

  if (
    normalizePlannerPreferenceText(left.preferences) !==
    normalizePlannerPreferenceText(right.preferences)
  ) {
    return false;
  }

  if (left.preferredDishes.length !== right.preferredDishes.length) {
    return false;
  }

  return left.preferredDishes.every((dish, index) => {
    const candidate = right.preferredDishes[index];
    return (
      dish.name.trim().toLowerCase() === candidate?.name.trim().toLowerCase() &&
      dish.mealType === candidate?.mealType
    );
  });
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

function normalizeRecipeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getRecipeDedupeKey(recipe: Pick<Recipe, "mealType" | "title">) {
  return `${recipe.mealType}:${normalizeRecipeTitle(recipe.title)}`;
}

function getRecipeSourcePriority(source: Recipe["source"]) {
  return source === "user-saved" ? 2 : 1;
}

function choosePreferredRecipe(current: Recipe, candidate: Recipe) {
  if (current.id === candidate.id) {
    return candidate;
  }

  const currentPriority = getRecipeSourcePriority(current.source);
  const candidatePriority = getRecipeSourcePriority(candidate.source);
  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }

  const currentRichness =
    current.ingredients.length +
    (current.instructions?.length ?? 0) +
    (current.referenceUrl ? 1 : 0);
  const candidateRichness =
    candidate.ingredients.length +
    (candidate.instructions?.length ?? 0) +
    (candidate.referenceUrl ? 1 : 0);

  if (candidateRichness !== currentRichness) {
    return candidateRichness > currentRichness ? candidate : current;
  }

  return candidate;
}

export function mergeRecipes(existingRecipes: Recipe[], incomingRecipes: Recipe[]) {
  const recipesById = new Map<string, Recipe>();
  const recipeIdByDedupeKey = new Map<string, string>();

  const ingestRecipe = (recipe: Recipe) => {
    const dedupeKey = getRecipeDedupeKey(recipe);
    const existingId = recipeIdByDedupeKey.get(dedupeKey);

    if (existingId) {
      const current = recipesById.get(existingId);
      if (!current) {
        recipesById.set(recipe.id, recipe);
        recipeIdByDedupeKey.set(dedupeKey, recipe.id);
        return;
      }

      const preferred = choosePreferredRecipe(current, recipe);
      if (preferred.id !== current.id) {
        recipesById.delete(current.id);
        recipesById.set(preferred.id, preferred);
        recipeIdByDedupeKey.set(dedupeKey, preferred.id);
      } else {
        recipesById.set(current.id, preferred);
      }
      return;
    }

    const currentById = recipesById.get(recipe.id);
    if (currentById) {
      recipesById.set(recipe.id, choosePreferredRecipe(currentById, recipe));
      recipeIdByDedupeKey.set(dedupeKey, recipe.id);
      return;
    }

    recipesById.set(recipe.id, recipe);
    recipeIdByDedupeKey.set(dedupeKey, recipe.id);
  };

  for (const recipe of existingRecipes) {
    ingestRecipe(recipe);
  }

  for (const recipe of incomingRecipes) {
    ingestRecipe(recipe);
  }

  return Array.from(recipesById.values());
}

function reconcilePreferredDishes(
  preferredDishes: PreferredDishRequest[],
  recipes: Recipe[],
): PreferredDishRequest[] {
  return preferredDishes.map((dish) => {
    const candidateRecipes = dish.mealType
      ? recipes.filter((recipe) => recipe.mealType === dish.mealType)
      : recipes;
    const resolved = resolveRecipeByDishName(dish.name, candidateRecipes);

    return {
      ...dish,
      status: resolved ? "resolved" : "failed",
      resolvedRecipeId: resolved?.id,
    };
  });
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
      const dish: PreferredDishRequest = {
        id: generateId(),
        name: action.name.trim(),
        mealType: action.mealType,
        status: "pending",
      };
      return {
        ...state,
        planner: {
          ...state.planner,
          preferredDishes: [...state.planner.preferredDishes, dish],
        },
      };
    }

    case "SET_PREFERRED_DISHES": {
      return {
        ...state,
        planner: {
          ...state.planner,
          preferredDishes: action.preferredDishes.map((dish) => ({
            id: dish.id,
            name: dish.name.trim(),
            mealType: dish.mealType,
            status: "pending",
          })),
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
        recipes: mergeRecipes(state.recipes, [action.recipe]),
      };
    }

    case "APPLY_GENERATED_PLAN": {
      const nextRecipes = mergeRecipes(state.recipes, action.recipes);
      const lastGeneratedConfig = createPlannerConfigSnapshot(state.planner);
      const { meals, groceryCart } = buildGeneratedWeeklyPlan({
        inventory: state.inventory,
        recipes: nextRecipes,
        mealSlots: action.mealSlots,
      });

      return {
        ...state,
        recipes: nextRecipes,
        planner: {
          ...state.planner,
          preferredDishes: reconcilePreferredDishes(state.planner.preferredDishes, nextRecipes),
          weeklyPlan: meals,
          groceryCart,
          selectedMealId: undefined,
          lastGeneratedConfig,
        },
      };
    }

    case "CLEAR_WEEKLY_PLAN": {
      return {
        ...state,
        planner: {
          ...state.planner,
          weeklyPlan: [],
          groceryCart: [],
          selectedMealId: undefined,
          lastGeneratedConfig: undefined,
        },
      };
    }

    case "REPLACE_PLANNED_MEAL": {
      const resolved = state.recipes.find((recipe) => recipe.id === action.recipeId) ?? null;
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
      if (!meal || meal.status === "completed") {
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
      if (!activeMeal || (activeMeal.mealType === action.mealType && activeMeal.day === action.day)) {
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
          return { ...plannedMeal, day: action.day, mealType: action.mealType };
        }
        if (targetMeal && plannedMeal.id === targetMeal.id) {
          return { ...plannedMeal, day: activeMeal.day, mealType: activeMeal.mealType };
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

    case "REMOVE_PLANNED_MEAL": {
      const nextPlan = state.planner.weeklyPlan.filter(
        (plannedMeal) => plannedMeal.id !== action.mealId,
      );
      const groceryCart = buildGroceryCartFromMeals(nextPlan, state.inventory);
      return {
        ...state,
        planner: {
          ...state.planner,
          weeklyPlan: nextPlan,
          groceryCart,
          selectedMealId:
            state.planner.selectedMealId === action.mealId
              ? undefined
              : state.planner.selectedMealId,
        },
      };
    }

    case "ADD_MEAL_TO_SLOT": {
      const recipe = state.recipes.find((r) => r.id === action.recipeId);
      if (!recipe) return state;

      const slotOccupied = state.planner.weeklyPlan.some(
        (m) => m.day === action.day && m.mealType === action.mealType,
      );
      if (slotOccupied) return state;

      const validation = validateRecipeAgainstInventory(recipe, state.inventory);
      const newMeal: PlannedMeal = {
        id: generateId(),
        day: action.day,
        mealType: action.mealType,
        recipe,
        status: "planned",
        validation,
      };
      const nextPlan = [...state.planner.weeklyPlan, newMeal];
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

    case "TOGGLE_GROCERY_ITEM": {
      const cartItem = state.planner.groceryCart.find((item) => item.id === action.itemId);
      const isChecking = cartItem && !cartItem.checked;

      const nextState: AppState = {
        ...state,
        planner: {
          ...state.planner,
          groceryCart: state.planner.groceryCart.map((item) =>
            item.id === action.itemId ? { ...item, checked: !item.checked } : item,
          ),
        },
      };

      if (isChecking && cartItem) {
        return applyStockItems(nextState, [
          {
            name: cartItem.displayName,
            quantity: cartItem.neededQuantity,
            unit: cartItem.unit,
            category: "other",
            storageType: "pantry",
            shelfName: "Groceries",
          },
        ]);
      }

      return nextState;
    }

    case "STOCK_ITEMS": {
      return applyStockItems(state, action.items);
    }

    case "LOAD_STATE": {
      return action.state;
    }

    default:
      return state;
  }
}

function normalizeShelfName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function getDefaultShelfName(storage: StorageLayout) {
  return `Shelf ${storage.shelves.length + 1}`;
}

/**
 * Finds or creates a shelf by name within a storage layout, returning both the
 * (possibly updated) layout and the resolved shelf.
 */
function findOrCreateShelf(
  storage: StorageLayout,
  shelfName: string,
): { storage: StorageLayout; shelf: Shelf } {
  const normalizedShelfName = normalizeShelfName(shelfName);
  const existing = storage.shelves.find(
    (s) => normalizeShelfName(s.name).toLowerCase() === normalizedShelfName.toLowerCase(),
  );
  if (existing) {
    return { storage, shelf: existing };
  }
  const newShelf = createShelf(normalizedShelfName || getDefaultShelfName(storage), 1, 3, 120);
  return {
    storage: { ...storage, shelves: [...storage.shelves, newShelf] },
    shelf: newShelf,
  };
}

function getMergeableInventoryItemIndex(
  inventory: InventoryItem[],
  incoming: StockingItemDraft,
  normalizedName: string,
  storageId: string,
  shelfId: string,
) {
  const incomingExpiry = incoming.expiresAt ?? "";

  for (let index = 0; index < inventory.length; index += 1) {
    const item = inventory[index];
    if (
      item.storageId !== storageId ||
      item.shelfId !== shelfId ||
      item.normalizedName !== normalizedName ||
      item.category !== incoming.category ||
      (item.expiresAt ?? "") !== incomingExpiry
    ) {
      continue;
    }

    if (convertQuantity(incoming.quantity, incoming.unit, item.unit) != null) {
      return index;
    }
  }

  return -1;
}

/**
 * Applies a batch of StockingItemDrafts to the state, creating shelves as
 * needed and assigning items to cells via round-robin.
 */
function applyStockItems(state: AppState, items: StockingItemDraft[]): AppState {
  let nextFridge = state.fridge;
  let nextPantry = state.pantry;
  const nextInventory = state.inventory.map((item) => ({ ...item }));
  const shelfItemCounts = new Map<string, number>();

  for (const item of nextInventory) {
    shelfItemCounts.set(item.shelfId, (shelfItemCounts.get(item.shelfId) ?? 0) + 1);
  }

  const groups = new Map<string, { storageType: StorageType; shelfName: string; items: StockingItemDraft[] }>();
  for (const item of items) {
    const key = `${item.storageType}:${normalizeShelfName(item.shelfName).toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        storageType: item.storageType,
        shelfName: normalizeShelfName(item.shelfName),
        items: [],
      });
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

    for (const item of group.items) {
      const normalizedName = normalizeIngredientName(item.name);
      if (!normalizedName) {
        continue;
      }

      const mergeIndex = getMergeableInventoryItemIndex(
        nextInventory,
        item,
        normalizedName,
        updatedStorage.id,
        shelf.id,
      );

      if (mergeIndex >= 0) {
        const currentItem = nextInventory[mergeIndex];
        const convertedQuantity = convertQuantity(item.quantity, item.unit, currentItem.unit);

        if (convertedQuantity != null) {
          nextInventory[mergeIndex] = {
            ...currentItem,
            quantity: currentItem.quantity + convertedQuantity,
          };
          continue;
        }
      }

      const currentCount = shelfItemCounts.get(shelf.id) ?? 0;
      const cellId = cells[currentCount % cells.length].id;

      nextInventory.push(
        createInventoryItem({
          emoji: item.emoji,
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
      shelfItemCounts.set(shelf.id, currentCount + 1);
    }
  }

  return {
    ...state,
    fridge: nextFridge,
    pantry: nextPantry,
    inventory: nextInventory,
  };
}
