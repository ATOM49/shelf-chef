"use client";

import type { InventoryItem } from "@/lib/inventory/types";
import type { Shelf } from "@/lib/fridge/types";
import { StorageShelf } from "@/components/storage/StorageShelf";

type FridgeShelfProps = {
  shelf: Shelf;
  inventory: InventoryItem[];
  isSelected: boolean;
  onSelect: () => void;
};

export function FridgeShelf({ shelf, inventory, isSelected, onSelect }: FridgeShelfProps) {
  return (
    <StorageShelf
      shelf={shelf}
      inventory={inventory}
      storageType="fridge"
      isSelected={isSelected}
      isDragging={false}
      isDropTarget={false}
      onSelect={onSelect}
      onDragStart={() => {}}
      onDragEnd={() => {}}
      onDragOver={() => {}}
      onDragLeave={() => {}}
      onDrop={() => {}}
    />
  );
}

