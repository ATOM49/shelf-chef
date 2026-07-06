"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type Ref,
} from "react";
import { CircleAlert } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DragHandle } from "@/components/ui/drag-handle";
import type { InventoryItem } from "@/lib/inventory/types";
import { CATEGORY_COLORS } from "@/lib/inventory/types";
import type { Shelf, StorageType } from "@/lib/fridge/types";
import { cn } from "@/lib/utils";

const SHELF_STYLES: Record<
  StorageType,
  {
    base: string;
    dropTarget: string;
  }
> = {
  fridge: {
    base: "border-border bg-card hover:border-muted-foreground/40",
    dropTarget: "border-primary/60 bg-primary/15 ring-2 ring-primary/20",
  },
  pantry: {
    base: "border-border bg-card hover:border-muted-foreground/40",
    dropTarget: "border-secondary/70 bg-secondary/45 ring-2 ring-secondary/45",
  },
};

const DRAGGABLE_CONTAINER_CLASS =
  "transition-[border-color,background-color,box-shadow,opacity,transform]";
const DRAGGING_CLASS = "opacity-60 shadow-lg ring-2 ring-ring/25";

type StorageShelfProps = {
  shelf: Shelf;
  inventory: InventoryItem[];
  storageType: StorageType;
  isDragging: boolean;
  isDropTarget: boolean;
  lowStockItemNames?: Set<string>;
  onMoveItem: (itemId: string, cellId: string, overItemId?: string) => void;
  rootRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  dragHandleRef?: Ref<HTMLButtonElement>;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
};

export function StorageShelf({
  shelf,
  inventory,
  storageType,
  isDragging,
  isDropTarget,
  lowStockItemNames,
  onMoveItem,
  rootRef,
  style,
  dragHandleRef,
  dragHandleProps,
}: StorageShelfProps) {
  const styles = SHELF_STYLES[storageType];
  const {
    onPointerDown: onDragHandlePointerDown,
    onClick: onDragHandleClick,
    ...sortableDragHandleProps
  } = dragHandleProps ?? {};
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [suppressedHoverItemId, setSuppressedHoverItemId] = useState<string>();
  const cells = useMemo(
    () =>
      shelf.cells.length > 0
        ? shelf.cells
        : [{ id: "cell-0-0", row: 0, col: 0 }],
    [shelf.cells],
  );
  const primaryCellId = cells[0].id;

  function handleItemDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current;
    const overData = event.over?.data.current;

    if (
      activeData?.type !== "inventory-item" ||
      typeof activeData.itemId !== "string"
    ) {
      return;
    }

    setSuppressedHoverItemId(activeData.itemId);

    const cellId =
      typeof overData?.cellId === "string" ? overData.cellId : primaryCellId;
    const overItemId =
      overData?.type === "inventory-item" && typeof overData.itemId === "string"
        ? overData.itemId
        : undefined;

    if (activeData.itemId === overItemId) {
      return;
    }

    onMoveItem(activeData.itemId, cellId, overItemId);
  }

  return (
    <div
      ref={rootRef}
      style={style}
      className={cn(
        "rounded-xl border-2 p-3",
        DRAGGABLE_CONTAINER_CLASS,
        styles.base,
        isDropTarget && styles.dropTarget,
        isDragging && DRAGGING_CLASS,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-foreground">
          {shelf.name}
        </span>
        <DragHandle
          ref={dragHandleRef}
          aria-label={`Reorder ${shelf.name}`}
          {...sortableDragHandleProps}
          onPointerDown={(event) => {
            event.stopPropagation();
            onDragHandlePointerDown?.(event);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onDragHandleClick?.(event);
          }}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => setSuppressedHoverItemId(undefined)}
        onDragEnd={handleItemDragEnd}
      >
        <ShelfItemsGrid
          cellId={primaryCellId}
          items={inventory}
          lowStockItemNames={lowStockItemNames}
          suppressedHoverItemId={suppressedHoverItemId}
          onClearSuppressedHoverItem={() => setSuppressedHoverItemId(undefined)}
        />
      </DndContext>
    </div>
  );
}

function ShelfItemsGrid({
  cellId,
  items,
  lowStockItemNames,
  suppressedHoverItemId,
  onClearSuppressedHoverItem,
}: {
  cellId: string;
  items: InventoryItem[];
  lowStockItemNames?: Set<string>;
  suppressedHoverItemId?: string;
  onClearSuppressedHoverItem: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `shelf-items:${cellId}`,
    data: { type: "shelf-items", cellId },
  });

  return (
    <SortableContext
      items={items.map((item) => item.id)}
      strategy={rectSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={cn(
          "grid min-h-[4.5rem] auto-rows-[3.5rem] grid-cols-[repeat(auto-fill,minmax(3.5rem,3.5rem))] content-start justify-start gap-2 rounded-lg border border-dashed border-border bg-background/60 p-2 transition-[background-color,border-color,box-shadow]",
          isOver && "border-primary/60 bg-primary/10 ring-2 ring-primary/15",
        )}
      >
        {items.length > 0 ? (
          <TooltipProvider>
            {items.map((item) => (
              <SortableItemChip
                key={item.id}
                item={item}
                isLowStock={lowStockItemNames?.has(item.normalizedName) ?? false}
                cellId={cellId}
                suppressHoverInfo={suppressedHoverItemId === item.id}
                onClearSuppressHoverInfo={onClearSuppressedHoverItem}
              />
            ))}
          </TooltipProvider>
        ) : (
          <div className="col-span-full flex min-h-12 items-center justify-center rounded-md border border-dashed bg-background/50 px-2 text-center text-[11px] text-muted-foreground">
            Drop items here
          </div>
        )}
      </div>
    </SortableContext>
  );
}

function SortableItemChip({
  item,
  isLowStock,
  cellId,
  suppressHoverInfo,
  onClearSuppressHoverInfo,
}: {
  item: InventoryItem;
  isLowStock: boolean;
  cellId: string;
  suppressHoverInfo: boolean;
  onClearSuppressHoverInfo: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: "inventory-item", itemId: item.id, cellId },
  });
  const { active } = useDndContext();
  const itemLabel = item.emoji?.trim() ? item.emoji : item.name;
  const quantityLabel = `${item.quantity} ${item.unit}`;
  const isItemDragActive = active?.data.current?.type === "inventory-item";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      aria-label={`${item.name}, ${quantityLabel}`}
      className={cn(
        "group relative flex size-full cursor-grab touch-none flex-col items-center justify-center overflow-hidden rounded-lg border bg-background px-2 py-2 text-center shadow-xs transition-[background-color,border-color,box-shadow,opacity,transform] hover:border-muted-foreground/40 hover:shadow-sm active:cursor-grabbing active:translate-y-px focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        CATEGORY_COLORS[item.category],
        isDragging && DRAGGING_CLASS,
        isLowStock && "border-amber-400 ring-2 ring-amber-300/60",
      )}
      onBlur={() => {
        if (suppressHoverInfo) {
          onClearSuppressHoverInfo();
        }
      }}
      onPointerLeave={() => {
        if (suppressHoverInfo) {
          onClearSuppressHoverInfo();
        }
      }}
      {...attributes}
      {...listeners}
    >
      {isLowStock ? (
        <Tooltip>
          <TooltipTrigger
            aria-label={`${item.name} is running low`}
            className="absolute top-1 right-1 inline-flex size-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm ring-1 ring-amber-600/20"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <CircleAlert className="size-3" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="top">Running low</TooltipContent>
        </Tooltip>
      ) : null}
      <span
        className={cn(
          "block max-w-full truncate leading-tight",
          item.emoji?.trim() ? "text-2xl" : "text-[11px] font-semibold",
        )}
      >
        {itemLabel}
      </span>
      <span
        className={cn(
          "pointer-events-none absolute inset-x-1 bottom-1 translate-y-1 rounded bg-background/95 px-1 py-0.5 text-[10px] font-medium opacity-0 shadow-sm transition group-hover:translate-y-0 group-focus-within:translate-y-0",
          !isItemDragActive &&
            !suppressHoverInfo &&
            "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        {item.name} · {quantityLabel}
      </span>
    </div>
  );
}
