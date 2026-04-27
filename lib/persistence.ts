import {
  createDefaultAppState,
  createInventoryItem,
  type AppState,
} from "@/lib/appState";
import { generateId } from "@/lib/id";
import { isSupportedUnit } from "@/lib/inventory/units";
import type { InventoryCategory, InventoryItem } from "@/lib/inventory/types";
import type { StorageLayout } from "@/lib/fridge/types";
import type {
  PlannedMealType,
  PlannerConfigSnapshot,
  PlannerPreferredDishInput,
  Recipe,
} from "@/lib/planner/types";
import { PLANNED_MEAL_TYPES, RECIPE_MEAL_TYPES } from "@/lib/planner/types";

const APP_STORAGE_KEY = "food-planner-app-state-v2";
const LEGACY_STORAGE_KEY = "food-planner-fridge-layout";
const FALLBACK_CATEGORY: InventoryCategory = "other";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSupportedUnit(value: unknown) {
  if (typeof value !== "string") return "count";
  const normalized = value.trim().toLowerCase();
  return isSupportedUnit(normalized) ? normalized : "count";
}

function revivePlannerPreferredDishInput(
  value: unknown,
): PlannerPreferredDishInput | undefined {
  if (!isObject(value) || typeof value.name !== "string") {
    return undefined;
  }

  const mealType: PlannerPreferredDishInput["mealType"] =
    typeof value.mealType === "string" &&
    RECIPE_MEAL_TYPES.includes(
      value.mealType as (typeof RECIPE_MEAL_TYPES)[number],
    )
      ? (value.mealType as PlannerPreferredDishInput["mealType"])
      : undefined;

  return {
    name: value.name.trim(),
    mealType,
  };
}

function revivePlannerConfigSnapshot(
  value: unknown,
): PlannerConfigSnapshot | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  return {
    preferences: typeof value.preferences === "string" ? value.preferences : "",
    selectedMealTypes: revivePlannerSelectedMealTypes(value.selectedMealTypes),
    preferredDishes: Array.isArray(value.preferredDishes)
      ? value.preferredDishes
          .map(revivePlannerPreferredDishInput)
          .filter((dish): dish is PlannerPreferredDishInput => Boolean(dish))
      : [],
  };
}

function revivePlannerSelectedMealTypes(value: unknown): PlannedMealType[] {
  if (!Array.isArray(value)) {
    return [...PLANNED_MEAL_TYPES];
  }

  const selected = new Set<PlannedMealType>(
    value.filter(
      (mealType): mealType is PlannedMealType =>
        typeof mealType === "string" &&
        PLANNED_MEAL_TYPES.includes(mealType as PlannedMealType),
    ),
  );
  const normalized = PLANNED_MEAL_TYPES.filter((mealType) =>
    selected.has(mealType),
  );
  return normalized.length > 0 ? normalized : [...PLANNED_MEAL_TYPES];
}

function normalizeRecipeSource(source: unknown): Recipe["source"] {
  return source === "user-saved" ? "user-saved" : "user-requested";
}

function migrateLegacyLayout(stored: unknown): AppState | undefined {
  if (!isObject(stored) || !Array.isArray(stored.shelves)) {
    return undefined;
  }

  const baseState = createDefaultAppState();
  const shelves = stored.shelves.filter(isObject).map((shelf) => ({
    id: typeof shelf.id === "string" ? shelf.id : generateId(),
    name: typeof shelf.name === "string" ? shelf.name : "Shelf",
    rows: typeof shelf.rows === "number" ? shelf.rows : 1,
    cols: typeof shelf.cols === "number" ? shelf.cols : 1,
    height: typeof shelf.height === "number" ? shelf.height : 120,
    cells: Array.isArray(shelf.cells)
      ? shelf.cells.filter(isObject).map((cell) => ({
          id: typeof cell.id === "string" ? cell.id : generateId(),
          row: typeof cell.row === "number" ? cell.row : 0,
          col: typeof cell.col === "number" ? cell.col : 0,
        }))
      : [],
    legacyItems: Array.isArray(shelf.items) ? shelf.items.filter(isObject) : [],
  }));

  const fridgeId =
    typeof stored.id === "string" ? stored.id : baseState.fridge.id;

  const inventory = shelves.flatMap((shelf) =>
    shelf.legacyItems.map((item) =>
      createInventoryItem({
        name: typeof item.name === "string" ? item.name : "Item",
        quantity: typeof item.quantity === "number" ? item.quantity : 1,
        unit: toSupportedUnit(item.unit),
        category: FALLBACK_CATEGORY,
        storageId: fridgeId,
        shelfId: shelf.id,
        cellId:
          typeof item.cellId === "string"
            ? item.cellId
            : (shelf.cells[0]?.id ?? "cell-0-0"),
        expiresAt:
          typeof item.expiresAt === "string" ? item.expiresAt : undefined,
      }),
    ),
  );

  return {
    ...baseState,
    fridge: {
      id: fridgeId,
      name:
        typeof stored.name === "string" ? stored.name : baseState.fridge.name,
      storageType: "fridge" as const,
      width:
        typeof stored.width === "number"
          ? stored.width
          : baseState.fridge.width,
      height:
        typeof stored.height === "number"
          ? stored.height
          : baseState.fridge.height,
      shelves: shelves.map((shelf) => ({
        id: shelf.id,
        name: shelf.name,
        rows: shelf.rows,
        cols: shelf.cols,
        height: shelf.height,
        cells: shelf.cells,
      })),
    },
    inventory,
  };
}

function reviveAppState(stored: unknown): AppState | undefined {
  if (
    !isObject(stored) ||
    !isObject(stored.fridge) ||
    !isObject(stored.planner) ||
    !Array.isArray(stored.inventory)
  ) {
    return undefined;
  }

  const defaults = createDefaultAppState();
  const storedPlanner = stored.planner as Record<string, unknown>;

  // Merge saved state with defaults so new fields are always present
  const planner = {
    ...defaults.planner,
    preferences:
      typeof storedPlanner.preferences === "string"
        ? storedPlanner.preferences
        : "",
    selectedMealTypes: revivePlannerSelectedMealTypes(
      storedPlanner.selectedMealTypes,
    ),
    weeklyPlan: Array.isArray(storedPlanner.weeklyPlan)
      ? storedPlanner.weeklyPlan
      : [],
    preferredDishes: Array.isArray(storedPlanner.preferredDishes)
      ? storedPlanner.preferredDishes
      : [],
    groceryCart: Array.isArray(storedPlanner.groceryCart)
      ? storedPlanner.groceryCart
      : [],
    selectedMealId:
      typeof storedPlanner.selectedMealId === "string"
        ? storedPlanner.selectedMealId
        : undefined,
    lastGeneratedConfig: revivePlannerConfigSnapshot(
      storedPlanner.lastGeneratedConfig,
    ),
  };

  // Normalize fridge: ensure storageType is set (old persisted data had `type: "single-door"`)
  const fridge = {
    ...defaults.fridge,
    ...(stored.fridge as StorageLayout),
    storageType: "fridge" as const,
  };

  // Load pantry from stored state or use default
  const pantry: StorageLayout = isObject(stored.pantry)
    ? {
        ...defaults.pantry,
        ...(stored.pantry as StorageLayout),
        storageType: "pantry",
      }
    : defaults.pantry;

  // Backfill storageId on items persisted before pantry was introduced
  const fridgeShelfIds = new Set(fridge.shelves.map((s) => s.id));
  const inventory = (stored.inventory as unknown[])
    .filter(isObject)
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        ...(item as InventoryItem),
        emoji: typeof item.emoji === "string" ? item.emoji : undefined,
        storageId:
          typeof item.storageId === "string"
            ? item.storageId
            : fridgeShelfIds.has(item.shelfId as string)
              ? fridge.id
              : pantry.id,
      };
    });

  // Normalize persisted recipes so legacy `system` sources become generated recipes.
  const storedRecipes = Array.isArray(stored.recipes)
    ? stored.recipes
        .filter(isObject)
        .map(
          (recipe) =>
            ({
              ...recipe,
              source: normalizeRecipeSource(recipe.source),
            }) as Recipe,
        )
    : [];

  return {
    ...(stored as AppState),
    fridge,
    pantry,
    customStapleNames: Array.isArray(stored.customStapleNames)
      ? (stored.customStapleNames as unknown[]).filter((n): n is string => typeof n === "string")
      : [],
    inventory,
    recipes: storedRecipes,
    planner,
  };
}

export function loadAppState(): AppState {
  if (typeof window === "undefined") {
    return createDefaultAppState();
  }

  try {
    const currentState = localStorage.getItem(APP_STORAGE_KEY);
    if (currentState) {
      const parsed = reviveAppState(JSON.parse(currentState));
      if (parsed) return parsed;
    }

    const legacyState = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyState) {
      const migrated = migrateLegacyLayout(JSON.parse(legacyState));
      if (migrated) return migrated;
    }
  } catch {
    // ignore malformed storage and reset to defaults
  }

  return createDefaultAppState();
}

export function saveAppState(state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

export function clearAppState() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(APP_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}
