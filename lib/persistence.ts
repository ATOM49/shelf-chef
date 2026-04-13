import { createDefaultAppState, createInventoryItem, type AppState } from "@/lib/appState";
import { generateId } from "@/lib/id";
import { isSupportedUnit } from "@/lib/inventory/units";
import type { InventoryCategory } from "@/lib/inventory/types";

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

function migrateLegacyLayout(stored: unknown): AppState | undefined {
  if (!isObject(stored) || !Array.isArray(stored.shelves)) {
    return undefined;
  }

  const baseState = createDefaultAppState();
  const shelves = stored.shelves
    .filter(isObject)
    .map((shelf) => ({
      id: typeof shelf.id === "string" ? shelf.id : generateId(),
      name: typeof shelf.name === "string" ? shelf.name : "Shelf",
      rows: typeof shelf.rows === "number" ? shelf.rows : 1,
      cols: typeof shelf.cols === "number" ? shelf.cols : 1,
      height: typeof shelf.height === "number" ? shelf.height : 120,
      cells: Array.isArray(shelf.cells)
        ? shelf.cells
            .filter(isObject)
            .map((cell) => ({
              id: typeof cell.id === "string" ? cell.id : generateId(),
              row: typeof cell.row === "number" ? cell.row : 0,
              col: typeof cell.col === "number" ? cell.col : 0,
            }))
        : [],
      legacyItems: Array.isArray(shelf.items) ? shelf.items.filter(isObject) : [],
    }));

  const inventory = shelves.flatMap((shelf) =>
    shelf.legacyItems.map((item) =>
      createInventoryItem({
        name: typeof item.name === "string" ? item.name : "Item",
        quantity: typeof item.quantity === "number" ? item.quantity : 1,
        unit: toSupportedUnit(item.unit),
        category: FALLBACK_CATEGORY,
        shelfId: shelf.id,
        cellId: typeof item.cellId === "string" ? item.cellId : shelf.cells[0]?.id ?? "cell-0-0",
        expiresAt: typeof item.expiresAt === "string" ? item.expiresAt : undefined,
      }),
    ),
  );

  return {
    ...baseState,
    fridge: {
      id: typeof stored.id === "string" ? stored.id : baseState.fridge.id,
      name: typeof stored.name === "string" ? stored.name : baseState.fridge.name,
      type: "single-door",
      width: typeof stored.width === "number" ? stored.width : baseState.fridge.width,
      height: typeof stored.height === "number" ? stored.height : baseState.fridge.height,
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
  if (!isObject(stored) || !isObject(stored.fridge) || !isObject(stored.planner) || !Array.isArray(stored.inventory)) {
    return undefined;
  }

  return stored as AppState;
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
