export type FridgeItem = {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?:
    | "vegetable"
    | "fruit"
    | "dairy"
    | "meat"
    | "drink"
    | "leftover"
    | "condiment"
    | "other";
  color?: string;
  expiresAt?: string;
  notes?: string;
  cellId: string;
};

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
  items: FridgeItem[];
};

export type FridgeLayout = {
  id: string;
  name: string;
  type: "single-door";
  width: number;
  height: number;
  shelves: Shelf[];
};

export type FridgeAction =
  | { type: "ADD_SHELF" }
  | { type: "REMOVE_SHELF"; shelfId: string }
  | { type: "UPDATE_SHELF"; shelfId: string; patch: Partial<Shelf> }
  | { type: "RESIZE_SHELF"; shelfId: string; rows: number; cols: number }
  | { type: "ADD_ITEM"; shelfId: string; item: FridgeItem }
  | {
      type: "UPDATE_ITEM";
      shelfId: string;
      itemId: string;
      patch: Partial<FridgeItem>;
    }
  | { type: "REMOVE_ITEM"; shelfId: string; itemId: string }
  | { type: "RESET" }
  | { type: "UPDATE_FRIDGE_NAME"; name: string };

export const CATEGORY_COLORS: Record<NonNullable<FridgeItem["category"]>, string> = {
  vegetable: "bg-green-100 text-green-800 border-green-200",
  fruit: "bg-orange-100 text-orange-800 border-orange-200",
  dairy: "bg-yellow-100 text-yellow-800 border-yellow-200",
  meat: "bg-red-100 text-red-800 border-red-200",
  drink: "bg-blue-100 text-blue-800 border-blue-200",
  leftover: "bg-zinc-200 text-zinc-700 border-zinc-300",
  condiment: "bg-purple-100 text-purple-800 border-purple-200",
  other: "bg-zinc-100 text-zinc-700 border-zinc-200",
};
