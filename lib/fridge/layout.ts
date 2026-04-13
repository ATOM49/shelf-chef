import type { FridgeLayout, Shelf, ShelfCell } from "@/lib/fridge/types";
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

export const createDefaultSingleDoorFridge = (): FridgeLayout => ({
  id: generateId(),
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

export const resizeShelf = (shelf: Shelf, rows: number, cols: number): Shelf => ({
  ...shelf,
  rows,
  cols,
  cells: createCells(rows, cols),
});
