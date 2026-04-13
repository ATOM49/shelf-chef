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

export type FridgeLayout = {
  id: string;
  name: string;
  type: "single-door";
  width: number;
  height: number;
  shelves: Shelf[];
};
