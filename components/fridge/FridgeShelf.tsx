"use client";

import type { InventoryItem } from "@/lib/inventory/types";
import type { Shelf } from "@/lib/fridge/types";
import { StorageShelf } from "@/components/storage/StorageShelf";

type FridgeShelfProps = {
  shelf: Shelf;
  inventory: InventoryItem[];
  isSelected: boolean;
  onSelect: () => void;
  onSelectCell: (cellId: string) => void;
};

export function FridgeShelf({ shelf, inventory, isSelected, onSelect, onSelectCell }: FridgeShelfProps) {
  return (
    <StorageShelf
      shelf={shelf}
      inventory={inventory}
      storageType="fridge"
      isSelected={isSelected}
      isDragging={false}
      isDropTarget={false}
      onSelect={onSelect}
      onSelectCell={onSelectCell}
      onDragStart={() => {}}
      onDragEnd={() => {}}
      onDragOver={() => {}}
      onDragLeave={() => {}}
      onDrop={() => {}}
    />
  );
}

