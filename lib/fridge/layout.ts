import type { FridgeLayout, StorageLayout, Shelf, ShelfCell } from "@/lib/fridge/types";
import { generateId } from "@/lib/id";

export const createCells = (rows: number, cols: number): ShelfCell[] => {
  const cells: ShelfCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
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
  height = 120,
): Shelf => ({
  id: generateId(),
  name,
  rows,
  cols,
  height,
  cells: createCells(rows, cols),
});

export const createEmptyFridge = (): FridgeLayout => ({
  id: generateId(),
  name: "My Fridge",
  storageType: "fridge",
  width: 360,
  height: 720,
  shelves: [],
});

export const createEmptyPantry = (): StorageLayout => ({
  id: generateId(),
  name: "My Pantry",
  storageType: "pantry",
  width: 360,
  height: 600,
  shelves: [],
});

export const resizeShelf = (shelf: Shelf, rows: number, cols: number): Shelf => ({
  ...shelf,
  rows,
  cols,
  cells: createCells(rows, cols),
});
