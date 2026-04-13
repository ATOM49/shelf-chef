"use client";

import React from "react";
import type { Shelf, FridgeItem } from "../types";
import { CATEGORY_COLORS } from "../types";

type FridgeShelfProps = {
  shelf: Shelf;
  isSelected: boolean;
  onSelect: () => void;
  onSelectCell: (cellId: string) => void;
};

export function FridgeShelf({
  shelf,
  isSelected,
  onSelect,
  onSelectCell,
}: FridgeShelfProps) {
  return (
    <div
      className={`rounded-xl border-2 p-3 cursor-pointer transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-zinc-200 bg-white hover:border-zinc-300"
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
          const cellItems = shelf.items.filter((item) => item.cellId === cell.id);

          return (
            <button
              key={cell.id}
              type="button"
              className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-2 text-left hover:border-zinc-400 hover:bg-zinc-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
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

function ItemChip({ item }: { item: FridgeItem }) {
  const colorClass = item.category
    ? CATEGORY_COLORS[item.category]
    : "bg-zinc-200 text-zinc-700 border-zinc-300";

  return (
    <div className={`rounded-md border px-2 py-1 text-xs font-medium ${colorClass}`}>
      <span className="block truncate">{item.name}</span>
      {item.quantity != null && (
        <span className="text-[10px] opacity-75">
          {item.quantity}
          {item.unit ?? ""}
        </span>
      )}
    </div>
  );
}
