"use client";

import type { DragEvent } from "react";
import type { InventoryItem } from "@/lib/inventory/types";
import { CATEGORY_COLORS } from "@/lib/inventory/types";
import type { Shelf, StorageType } from "@/lib/fridge/types";

const SHELF_STYLES: Record<
  StorageType,
  {
    base: string;
    selected: string;
    dropTarget: string;
    dragging: string;
    handle: string;
    cell: string;
  }
> = {
  fridge: {
    base: "border-border bg-card hover:border-muted-foreground/40",
    selected: "border-primary bg-primary/10",
    dropTarget: "border-primary/60 bg-primary/15 ring-2 ring-primary/20",
    dragging: "opacity-60",
    handle: "text-muted-foreground hover:bg-muted hover:text-foreground",
    cell: "border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/45",
  },
  pantry: {
    base: "border-border bg-card hover:border-muted-foreground/40",
    selected: "border-secondary bg-secondary/35",
    dropTarget: "border-secondary/70 bg-secondary/45 ring-2 ring-secondary/45",
    dragging: "opacity-60",
    handle: "text-muted-foreground hover:bg-muted hover:text-foreground",
    cell: "border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/45",
  },
};

type StorageShelfProps = {
  shelf: Shelf;
  inventory: InventoryItem[];
  storageType: StorageType;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onSelect: () => void;
  onSelectCell: (cellId: string) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
};

export function StorageShelf({
  shelf,
  inventory,
  storageType,
  isSelected,
  isDragging,
  isDropTarget,
  onSelect,
  onSelectCell,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: StorageShelfProps) {
  const styles = SHELF_STYLES[storageType];

  return (
    <div
      className={[
        "cursor-pointer rounded-xl border-2 p-3 transition-[border-color,background-color,box-shadow,opacity]",
        isSelected ? styles.selected : styles.base,
        isDropTarget ? styles.dropTarget : "",
        isDragging ? styles.dragging : "",
      ].join(" ")}
      onClick={onSelect}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-foreground">
          {shelf.name}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {shelf.rows} × {shelf.cols}
          </span>
          <button
            type="button"
            draggable
            aria-label={`Reorder ${shelf.name}`}
            className={`cursor-grab rounded-md p-1 text-sm leading-none transition-colors active:cursor-grabbing ${styles.handle}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            ::
          </button>
        </div>
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
              className={`rounded-lg border border-dashed p-2 text-left transition-colors ${styles.cell}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectCell(cell.id);
              }}
            >
              {cellItems.length === 0 ? (
                <span className="text-xs text-muted-foreground">Empty</span>
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
    <div
      className={`rounded-md border px-2 py-1 text-xs font-medium ${CATEGORY_COLORS[item.category]}`}
    >
      <span className="block truncate">{item.emoji} {item.name}</span>
      <span className="block text-[10px] opacity-75">
        {item.quantity} {item.unit}
      </span>
    </div>
  );
}
