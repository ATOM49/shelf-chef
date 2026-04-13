"use client";

import type { InventoryItem } from "@/lib/inventory/types";
import { CATEGORY_COLORS } from "@/lib/inventory/types";
import type { Shelf } from "@/lib/fridge/types";

type FridgeShelfProps = {
  shelf: Shelf;
  inventory: InventoryItem[];
  isSelected: boolean;
  onSelect: () => void;
  onSelectCell: (cellId: string) => void;
};

export function FridgeShelf({ shelf, inventory, isSelected, onSelect, onSelectCell }: FridgeShelfProps) {
  return (
    <div
      className={`rounded-xl border-2 p-3 transition-colors ${
        isSelected ? "border-blue-500 bg-blue-50" : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
      onClick={onSelect}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">{shelf.name}</span>
        <span className="text-xs text-zinc-400">
          {shelf.rows} × {shelf.cols}
        </span>
      </div>

      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${shelf.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${shelf.rows}, minmax(64px, 1fr))`,
          minHeight: shelf.height,
        }}
      >
        {shelf.cells.map((cell) => {
          const cellItems = inventory.filter((item) => item.cellId === cell.id);

          return (
            <button
              key={cell.id}
              type="button"
              className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-2 text-left hover:border-zinc-400 hover:bg-zinc-100 transition-colors"
              onClick={(event) => {
                event.stopPropagation();
                onSelectCell(cell.id);
              }}
            >
              {cellItems.length === 0 ? (
                <span className="text-xs text-zinc-400">Empty</span>
              ) : (
                <div className="flex flex-col gap-1">
                  {cellItems.map((item) => (
                    <ItemChip key={item.id} item={item} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ItemChip({ item }: { item: InventoryItem }) {
  return (
    <div className={`rounded-md border px-2 py-1 text-xs font-medium ${CATEGORY_COLORS[item.category]}`}>
      <span className="block truncate">{item.name}</span>
      <span className="block text-[10px] opacity-75">
        {item.quantity} {item.unit}
      </span>
      {item.expiresAt ? <span className="block text-[10px] opacity-60">Exp {item.expiresAt}</span> : null}
    </div>
  );
}
