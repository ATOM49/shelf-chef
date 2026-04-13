"use client";

import type { FridgeLayout } from "@/lib/fridge/types";
import type { InventoryItem } from "@/lib/inventory/types";
import { FridgeShelf } from "@/components/fridge/FridgeShelf";

type FridgeCanvasProps = {
  layout: FridgeLayout;
  inventory: InventoryItem[];
  selectedShelfId?: string;
  onSelectShelf: (shelfId: string) => void;
  onSelectCell: (shelfId: string, cellId: string) => void;
};

export function FridgeCanvas({
  layout,
  inventory,
  selectedShelfId,
  onSelectShelf,
  onSelectCell,
}: FridgeCanvasProps) {
  return (
    <div className="flex justify-center">
      <div
        className="relative w-[360px] rounded-[32px] border-4 border-zinc-300 bg-zinc-50 p-4 shadow-xl"
        style={{ minHeight: layout.height }}
      >
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
          <div className="h-20 w-2.5 rounded-full bg-zinc-300 shadow-inner" />
        </div>

        <div className="mb-4 flex items-center justify-between pr-6">
          <h2 className="text-base font-semibold text-zinc-700">{layout.name}</h2>
          <span className="text-xs text-zinc-400">Inventory view</span>
        </div>

        <div className="flex flex-col gap-3 pr-5">
          {layout.shelves.map((shelf) => (
            <FridgeShelf
              key={shelf.id}
              shelf={shelf}
              inventory={inventory.filter((item) => item.shelfId === shelf.id)}
              isSelected={selectedShelfId === shelf.id}
              onSelect={() => onSelectShelf(shelf.id)}
              onSelectCell={(cellId) => onSelectCell(shelf.id, cellId)}
            />
          ))}
        </div>

        <div className="mt-4 h-3 rounded-b-2xl bg-zinc-200 pr-5" />
      </div>
    </div>
  );
}
