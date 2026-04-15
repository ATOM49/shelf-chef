"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import type { StorageLayout } from "@/lib/fridge/types";
import type { InventoryItem } from "@/lib/inventory/types";
import { StorageShelf } from "@/components/storage/StorageShelf";

type StorageCanvasProps = {
  layout: StorageLayout;
  inventory: InventoryItem[];
  selectedShelfId?: string;
  onSelectShelf: (shelfId: string) => void;
  onSelectCell: (shelfId: string, cellId: string) => void;
  onReorderShelves: (activeShelfId: string, overShelfId: string) => void;
};

type StorageCanvasFrameProps = {
  layout: StorageLayout;
  shelfNodes: ReactNode;
};

export function StorageCanvas(props: StorageCanvasProps) {
  const [draggedShelfId, setDraggedShelfId] = useState<string>();
  const [dropTargetShelfId, setDropTargetShelfId] = useState<string>();

  const clearDragState = () => {
    setDraggedShelfId(undefined);
    setDropTargetShelfId(undefined);
  };

  const handleShelfDragStart = (event: DragEvent<HTMLButtonElement>, shelfId: string) => {
    setDraggedShelfId(shelfId);
    setDropTargetShelfId(undefined);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", shelfId);
  };

  const handleShelfDragOver = (event: DragEvent<HTMLDivElement>, shelfId: string) => {
    if (!draggedShelfId || draggedShelfId === shelfId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetShelfId !== shelfId) {
      setDropTargetShelfId(shelfId);
    }
  };

  const handleShelfDragLeave = (event: DragEvent<HTMLDivElement>, shelfId: string) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    setDropTargetShelfId((current) => (current === shelfId ? undefined : current));
  };

  const handleShelfDrop = (event: DragEvent<HTMLDivElement>, shelfId: string) => {
    event.preventDefault();
    const activeShelfId = event.dataTransfer.getData("text/plain") || draggedShelfId;

    if (activeShelfId && activeShelfId !== shelfId) {
      props.onReorderShelves(activeShelfId, shelfId);
    }

    clearDragState();
  };

  const shelfNodes = props.layout.shelves.map((shelf) => (
    <StorageShelf
      key={shelf.id}
      shelf={shelf}
      inventory={props.inventory.filter((item) => item.shelfId === shelf.id)}
      storageType={props.layout.storageType}
      isSelected={props.selectedShelfId === shelf.id}
      isDragging={draggedShelfId === shelf.id}
      isDropTarget={dropTargetShelfId === shelf.id && draggedShelfId !== shelf.id}
      onSelect={() => props.onSelectShelf(shelf.id)}
      onSelectCell={(cellId) => props.onSelectCell(shelf.id, cellId)}
      onDragStart={(event) => handleShelfDragStart(event, shelf.id)}
      onDragEnd={clearDragState}
      onDragOver={(event) => handleShelfDragOver(event, shelf.id)}
      onDragLeave={(event) => handleShelfDragLeave(event, shelf.id)}
      onDrop={(event) => handleShelfDrop(event, shelf.id)}
    />
  ));

  const hasInventory = props.inventory.length > 0;
  const content = hasInventory ? (
    shelfNodes
  ) : (
    <StorageEmptyState
      storageType={props.layout.storageType}
      shelfCount={props.layout.shelves.length}
    />
  );

  if (props.layout.storageType === "pantry") {
    return <PantryCanvas layout={props.layout} shelfNodes={content} />;
  }
  return <FridgeCanvasInner layout={props.layout} shelfNodes={content} />;
}

function StorageEmptyState({
  storageType,
  shelfCount,
}: {
  storageType: StorageLayout["storageType"];
  shelfCount: number;
}) {
  const isFridge = storageType === "fridge";
  const title = isFridge ? "Fridge is empty" : "Pantry is empty";
  const description = isFridge
    ? "Stock cold items and AI will create the right fridge shelves as it organizes them for review."
    : "Stock dry goods, spices, and pantry staples and AI will create pantry shelves as needed.";
  const shelfMessage = shelfCount > 0
    ? "Start stocking items to organize them into these shelves."
    : "No shelves yet. They will be created as you stock items.";

  return (
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs text-muted-foreground">{shelfMessage}</p>
    </div>
  );
}

function FridgeCanvasInner({ layout, shelfNodes }: StorageCanvasFrameProps) {
  return (
    <div className="flex justify-center">
      <div
        className="relative w-90 rounded-[32px] border-4 border-zinc-300 bg-zinc-50 p-4 shadow-xl"
        style={{ minHeight: layout.height }}
      >
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
          <div className="h-20 w-2.5 rounded-full bg-zinc-300 shadow-inner" />
        </div>

        <div className="mb-4 flex items-center justify-between pr-6">
          <h2 className="text-base font-semibold text-zinc-700">{layout.name}</h2>
          <span className="text-xs text-zinc-400">Inventory view</span>
        </div>

        <div className="flex flex-col gap-3 pr-5">{shelfNodes}</div>

        <div className="mt-4 h-3 rounded-b-2xl bg-zinc-200 pr-5" />
      </div>
    </div>
  );
}

function PantryCanvas({ layout, shelfNodes }: StorageCanvasFrameProps) {
  return (
    <div className="flex justify-center">
      <div
        className="relative w-90 overflow-hidden rounded-2xl border-2 border-stone-300 bg-white shadow-md"
        style={{ minHeight: layout.height }}
      >
        {/* Top accent bar */}
        <div className="h-3 w-full bg-stone-200" />

        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-700">{layout.name}</h2>
            <span className="text-xs text-stone-400">Pantry view</span>
          </div>

          <div className="flex flex-col gap-3">{shelfNodes}</div>
        </div>

        {/* Bottom accent bar */}
        <div className="h-2 w-full bg-stone-200" />
      </div>
    </div>
  );
}
