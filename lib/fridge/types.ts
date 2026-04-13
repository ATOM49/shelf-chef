export type StorageType = "fridge" | "pantry";

export type ShelfCell = {
  id: string;
  row: number;
  col: number;
};

export type Shelf = {
  id: string;
  name: string;
  rows: number;
  cols: number;
  height: number;
  cells: ShelfCell[];
};

export type StorageLayout = {
  id: string;
  name: string;
  storageType: StorageType;
  width: number;
  height: number;
  shelves: Shelf[];
};

export type FridgeLayout = StorageLayout & { storageType: "fridge" };
