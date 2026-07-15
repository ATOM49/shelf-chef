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
import { DEFAULT_WORKSPACE, parseSerializedWorkspace, serializeWorkspace, type Workspace } from "@/lib/households/shared";

const APP_STORAGE_KEY = "stockpot-app-state-v2";
const LEGACY_APP_STORAGE_KEYS = ["food-planner-app-state-v2"];
const LEGACY_STORAGE_KEY = "food-planner-fridge-layout";
const FALLBACK_CATEGORY: InventoryCategory = "other";

const ACTIVE_WORKSPACE_KEY = "stockpot-active-workspace-v1";
const LEGACY_ACTIVE_WORKSPACE_KEYS = ["food-planner-active-workspace-v1"];
const WORKSPACE_STORAGE_PREFIX = "stockpot-workspace-state-v1";
const LEGACY_WORKSPACE_STORAGE_PREFIXES = ["food-planner-workspace-state-v1"];

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

function normalizeRecipeImageStatus(status: unknown): Recipe["imageStatus"] {
  return status === "pending" ||
    status === "generating" ||
    status === "ready" ||
    status === "failed"
    ? status
    : undefined;
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

export function parsePersistedAppState(stored: unknown): AppState | undefined {
  return reviveAppState(stored);
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
              imageUrl:
                typeof recipe.imageUrl === "string" &&
                (recipe.imageUrl.startsWith("https://") ||
                  recipe.imageUrl.startsWith("/api/recipes/images/"))
                  ? recipe.imageUrl
                  : undefined,
              imageStatus: normalizeRecipeImageStatus(recipe.imageStatus),
              imageUpdatedAt:
                typeof recipe.imageUpdatedAt === "string"
                  ? recipe.imageUpdatedAt
                  : undefined,
            }) as Recipe,
        )
    : [];
  const storedRecipeImageGeneration = isObject(stored.recipeImageGeneration)
    ? stored.recipeImageGeneration
    : undefined;
  const recipeImageGeneration =
    storedRecipeImageGeneration &&
    Array.isArray(storedRecipeImageGeneration.recipeIds) &&
    typeof storedRecipeImageGeneration.startedAt === "string"
      ? {
          recipeIds: storedRecipeImageGeneration.recipeIds.filter(
            (recipeId): recipeId is string => typeof recipeId === "string",
          ),
          startedAt: storedRecipeImageGeneration.startedAt,
        }
      : undefined;

  return {
    ...(stored as AppState),
    fridge,
    pantry,
    customStapleNames: Array.isArray(stored.customStapleNames)
      ? (stored.customStapleNames as unknown[]).filter((n): n is string => typeof n === "string")
      : [],
    inventory,
    recipes: storedRecipes,
    recipeImageGeneration,
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

    for (const legacyKey of LEGACY_APP_STORAGE_KEYS) {
      const legacyAppState = localStorage.getItem(legacyKey);
      if (legacyAppState) {
        const parsed = reviveAppState(JSON.parse(legacyAppState));
        if (parsed) return parsed;
      }
    }

    const legacyLayout = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyLayout) {
      const migrated = migrateLegacyLayout(JSON.parse(legacyLayout));
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
    for (const legacyKey of LEGACY_APP_STORAGE_KEYS) {
      localStorage.removeItem(legacyKey);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

function getWorkspaceStorageKey(workspace: Workspace) {
  return `${WORKSPACE_STORAGE_PREFIX}:${serializeWorkspace(workspace)}`;
}

function getLegacyWorkspaceStorageKeys(workspace: Workspace) {
  return LEGACY_WORKSPACE_STORAGE_PREFIXES.map(
    (prefix) => `${prefix}:${serializeWorkspace(workspace)}`,
  );
}

export function loadWorkspacePreference(): Workspace {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE;
  }

  try {
    const activeWorkspace = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    if (activeWorkspace) {
      return parseSerializedWorkspace(activeWorkspace);
    }

    for (const legacyKey of LEGACY_ACTIVE_WORKSPACE_KEYS) {
      const legacyWorkspace = localStorage.getItem(legacyKey);
      if (legacyWorkspace) {
        return parseSerializedWorkspace(legacyWorkspace);
      }
    }

    return DEFAULT_WORKSPACE;
  } catch {
    return DEFAULT_WORKSPACE;
  }
}

export function saveWorkspacePreference(workspace: Workspace) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, serializeWorkspace(workspace));
  } catch {
    // ignore storage failures
  }
}

export function loadWorkspaceAppState(workspace: Workspace): AppState {
  if (typeof window === "undefined") {
    return createDefaultAppState();
  }

  try {
    const workspaceState = localStorage.getItem(getWorkspaceStorageKey(workspace));
    if (workspaceState) {
      const parsed = reviveAppState(JSON.parse(workspaceState));
      if (parsed) return parsed;
    }

    for (const legacyKey of getLegacyWorkspaceStorageKeys(workspace)) {
      const legacyWorkspaceState = localStorage.getItem(legacyKey);
      if (legacyWorkspaceState) {
        const parsed = reviveAppState(JSON.parse(legacyWorkspaceState));
        if (parsed) return parsed;
      }
    }

    if (workspace.type === "personal") {
      return loadAppState();
    }
  } catch {
    // ignore malformed storage and reset to defaults
  }

  return createDefaultAppState();
}

export function saveWorkspaceAppState(workspace: Workspace, state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(getWorkspaceStorageKey(workspace), serialized);
    if (workspace.type === "personal") {
      localStorage.setItem(APP_STORAGE_KEY, serialized);
    }
  } catch {
    // ignore storage failures
  }
}

export function clearWorkspaceAppState(workspace: Workspace) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(getWorkspaceStorageKey(workspace));
    for (const legacyKey of getLegacyWorkspaceStorageKeys(workspace)) {
      localStorage.removeItem(legacyKey);
    }
    if (workspace.type === "personal") {
      clearAppState();
    }
  } catch {
    // ignore storage failures
  }
}
