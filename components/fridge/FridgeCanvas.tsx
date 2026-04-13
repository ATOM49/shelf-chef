"use client";

import type { FridgeLayout } from "@/lib/fridge/types";
import type { InventoryItem } from "@/lib/inventory/types";
import { StorageCanvas } from "@/components/storage/StorageCanvas";

type FridgeCanvasProps = {
  layout: FridgeLayout;
  inventory: InventoryItem[];
  selectedShelfId?: string;
  onSelectShelf: (shelfId: string) => void;
  onSelectCell: (shelfId: string, cellId: string) => void;
  onReorderShelves?: (activeShelfId: string, overShelfId: string) => void;
};

export function FridgeCanvas(props: FridgeCanvasProps) {
  return <StorageCanvas {...props} onReorderShelves={props.onReorderShelves ?? (() => {})} />;
}

