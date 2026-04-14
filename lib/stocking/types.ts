import type { InventoryCategory, InventoryUnit } from "@/lib/inventory/types";
import type { StorageType } from "@/lib/fridge/types";

/** Minimal user-supplied input — only name is required */
export type StockingDraft = {
  name: string;
  quantity?: number;
  unit?: string;
};

/** LLM-enriched item ready for review */
export type StockedItem = {
  /** Local row key for React */
  id: string;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  category: InventoryCategory;
  storageType: StorageType;
  /** Suggested shelf name; reducer will find or create it */
  shelfName: string;
  /** ISO date string (YYYY-MM-DD), omitted for shelf-stable items */
  expiresAt?: string;
  /** True when the LLM was uncertain about one or more fields */
  flagged: boolean;
};

/** Body sent to /api/stock */
export type StockApiRequest = {
  items: StockingDraft[];
};

/** Body returned from /api/stock */
export type StockApiResponse = {
  items: StockedItem[];
};
