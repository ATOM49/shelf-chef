import type { InventoryCategory, InventoryUnit } from "@/lib/inventory/types";
import type { StorageType } from "@/lib/fridge/types";
import type { PresetId } from "@/lib/inventory/presets";

export type StockReviewItem = {
  emoji?: string;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  category: InventoryCategory;
  storageType: StorageType;
  shelfName: string;
  expiresAt?: string;
  flagged: boolean;
};

export type StockedItem = StockReviewItem & {
  id: string;
};

export type StockTextRequest = {
  input: string;
  stapleNames?: string[];
};

export type StockImageRequest = {
  stapleNames?: string[];
};

export type StockPresetRequest = {
  presetId: PresetId;
  stapleNames?: string[];
};

export type StockApiResponse = {
  items: StockReviewItem[];
};
