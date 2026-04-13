import type { FridgeLayout, FridgeAction, Shelf, ShelfCell } from "./types";

export const createCells = (rows: number, cols: number): ShelfCell[] => {
  const cells: ShelfCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        id: `cell-${row}-${col}`,
        row,
        col,
      });
    }
  }
  return cells;
};

export const createShelf = (
  name: string,
  rows: number,
  cols: number,
  height = 120
): Shelf => ({
  id: crypto.randomUUID(),
  name,
  rows,
  cols,
  height,
  cells: createCells(rows, cols),
  items: [],
});

export const createDefaultSingleDoorFridge = (): FridgeLayout => ({
  id: crypto.randomUUID(),
  name: "My Fridge",
  type: "single-door",
  width: 360,
  height: 720,
  shelves: [
    createShelf("Top Shelf", 1, 3, 100),
    createShelf("Upper Middle Shelf", 1, 4, 120),
    createShelf("Lower Middle Shelf", 1, 3, 120),
    createShelf("Bottom Shelf", 1, 2, 140),
  ],
});

export const resizeShelf = (shelf: Shelf, rows: number, cols: number): Shelf => {
  const newCells = createCells(rows, cols);
  const validCellIds = new Set(newCells.map((c) => c.id));
  const fallbackCellId = newCells[0]?.id;

  const remappedItems = shelf.items.map((item) => ({
    ...item,
    cellId: validCellIds.has(item.cellId)
      ? item.cellId
      : (fallbackCellId ?? item.cellId),
  }));

  return {
    ...shelf,
    rows,
    cols,
    cells: newCells,
    items: remappedItems,
  };
};

export const fridgeReducer = (
  state: FridgeLayout,
  action: FridgeAction
): FridgeLayout => {
  switch (action.type) {
    case "ADD_SHELF": {
      const newShelf = createShelf(`Shelf ${state.shelves.length + 1}`, 1, 3, 120);
      return { ...state, shelves: [...state.shelves, newShelf] };
    }

    case "REMOVE_SHELF": {
      return {
        ...state,
        shelves: state.shelves.filter((s) => s.id !== action.shelfId),
      };
    }

    case "UPDATE_SHELF": {
      return {
        ...state,
        shelves: state.shelves.map((s) =>
          s.id === action.shelfId ? { ...s, ...action.patch } : s
        ),
      };
    }

    case "RESIZE_SHELF": {
      return {
        ...state,
        shelves: state.shelves.map((s) =>
          s.id === action.shelfId ? resizeShelf(s, action.rows, action.cols) : s
        ),
      };
    }

    case "ADD_ITEM": {
      return {
        ...state,
        shelves: state.shelves.map((s) =>
          s.id === action.shelfId
            ? { ...s, items: [...s.items, action.item] }
            : s
        ),
      };
    }

    case "UPDATE_ITEM": {
      return {
        ...state,
        shelves: state.shelves.map((s) =>
          s.id === action.shelfId
            ? {
                ...s,
                items: s.items.map((item) =>
                  item.id === action.itemId
                    ? { ...item, ...action.patch }
                    : item
                ),
              }
            : s
        ),
      };
    }

    case "REMOVE_ITEM": {
      return {
        ...state,
        shelves: state.shelves.map((s) =>
          s.id === action.shelfId
            ? { ...s, items: s.items.filter((item) => item.id !== action.itemId) }
            : s
        ),
      };
    }

    case "UPDATE_FRIDGE_NAME": {
      return { ...state, name: action.name };
    }

    case "RESET": {
      return createDefaultSingleDoorFridge();
    }

    default:
      return state;
  }
};
