"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StorageLayout } from "@/lib/fridge/types";
import type { InventoryItem } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
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
  shelfNodes: ReactNode;
  contentCount: number;
};

const BASE_SHELF_GAP = 12;
const SCROLL_THRESHOLD = 1;

export function StorageCanvas(props: StorageCanvasProps) {
  const [draggedShelfId, setDraggedShelfId] = useState<string>();
  const [dropTargetShelfId, setDropTargetShelfId] = useState<string>();

  const clearDragState = () => {
    setDraggedShelfId(undefined);
    setDropTargetShelfId(undefined);
  };

  const handleShelfDragStart = (
    event: DragEvent<HTMLButtonElement>,
    shelfId: string,
  ) => {
    setDraggedShelfId(shelfId);
    setDropTargetShelfId(undefined);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", shelfId);
  };

  const handleShelfDragOver = (
    event: DragEvent<HTMLDivElement>,
    shelfId: string,
  ) => {
    if (!draggedShelfId || draggedShelfId === shelfId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetShelfId !== shelfId) {
      setDropTargetShelfId(shelfId);
    }
  };

  const handleShelfDragLeave = (
    event: DragEvent<HTMLDivElement>,
    shelfId: string,
  ) => {
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    setDropTargetShelfId((current) =>
      current === shelfId ? undefined : current,
    );
  };

  const handleShelfDrop = (
    event: DragEvent<HTMLDivElement>,
    shelfId: string,
  ) => {
    event.preventDefault();
    const activeShelfId =
      event.dataTransfer.getData("text/plain") || draggedShelfId;

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
      isDropTarget={
        dropTargetShelfId === shelf.id && draggedShelfId !== shelf.id
      }
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
  const contentCount = hasInventory ? Math.max(props.layout.shelves.length, 1) : 1;
  const content = hasInventory ? (
    shelfNodes
  ) : (
    <StorageEmptyState
      storageType={props.layout.storageType}
    />
  );

  if (props.layout.storageType === "pantry") {
    return (
      <PantryCanvas
        shelfNodes={content}
        contentCount={contentCount}
      />
    );
  }
  return (
    <FridgeCanvasInner
      shelfNodes={content}
      contentCount={contentCount}
    />
  );
}

function StorageEmptyState({
  storageType,
}: {
  storageType: StorageLayout["storageType"];
}) {
  const isFridge = storageType === "fridge";
  const title = isFridge ? "Fridge is empty" : "Pantry is empty";
  return (
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
  );
}

function FridgeCanvasInner({
  shelfNodes,
  contentCount,
}: StorageCanvasFrameProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <div
        className="relative flex h-full w-90 max-w-full flex-col overflow-hidden rounded-[32px] border-4 border-border bg-card p-4 shadow-xl"
        // style={{ height: `min(100%, ${layout.height}px)` }}
      >
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
          <div className="h-20 w-2.5 rounded-full bg-border shadow-inner" />
        </div>

        {/* <div className="mb-4 flex items-center justify-between pr-6">
          <h2 className="text-base font-semibold text-foreground">
            {layout.name}
          </h2>
        </div> */}

        <CanvasShelfViewport
          contentCount={contentCount}
          fadeColorClassName="from-card via-card/90"
          className="pr-2"
          contentClassName="pr-3"
        >
          {shelfNodes}
        </CanvasShelfViewport>

        <div className="mt-4 h-3 shrink-0 rounded-b-2xl bg-muted pr-5" />
      </div>
    </div>
  );
}

function PantryCanvas({
  shelfNodes,
  contentCount,
}: StorageCanvasFrameProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <div
        className="relative flex h-full w-90 max-w-full flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-md"
        // style={{ height: `min(100%, ${layout.height}px)` }}
      >
        <div className="h-3 w-full shrink-0 bg-muted" />

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <CanvasShelfViewport
            contentCount={contentCount}
            fadeColorClassName="from-card via-card/90"
          >
            {shelfNodes}
          </CanvasShelfViewport>
        </div>

        <div className="h-2 w-full shrink-0 bg-muted" />
      </div>
    </div>
  );
}

function CanvasShelfViewport({
  children,
  contentCount,
  fadeColorClassName,
  className,
  contentClassName,
}: {
  children: ReactNode;
  contentCount: number;
  fadeColorClassName: string;
  className?: string;
  contentClassName?: string;
}) {
  const { scrollRootRef, contentRef, canScrollDown, canScrollUp, distributedGap } =
    useCanvasScrollState(contentCount);
  const isSinglePanel = contentCount <= 1;

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div ref={scrollRootRef} className="h-full">
        <ScrollArea className="h-full" hideScrollbar>
          <div
            ref={contentRef}
            className={cn("flex min-h-full flex-col", contentClassName)}
            style={{
              gap: `${distributedGap}px`,
              justifyContent: isSinglePanel ? "center" : undefined,
            }}
          >
            {children}
          </div>
        </ScrollArea>
      </div>
      <ScrollFade
        position="top"
        visible={canScrollUp}
        fadeColorClassName={fadeColorClassName}
      />
      <ScrollFade
        position="bottom"
        visible={canScrollDown}
        fadeColorClassName={fadeColorClassName}
      />
    </div>
  );
}

function ScrollFade({
  position,
  visible,
  fadeColorClassName,
}: {
  position: "top" | "bottom";
  visible: boolean;
  fadeColorClassName: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 h-8 transition-opacity duration-200",
        position === "top"
          ? "top-0 bg-linear-to-b to-transparent"
          : "bottom-0 bg-linear-to-t to-transparent",
        fadeColorClassName,
        visible ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

function useCanvasScrollState(contentCount: number) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({
    canScrollDown: false,
    canScrollUp: false,
    distributedGap: BASE_SHELF_GAP,
  });

  useLayoutEffect(() => {
    const scrollRoot = scrollRootRef.current;
    const content = contentRef.current;
    const viewport = scrollRoot?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );

    if (!content || !viewport) {
      return;
    }

    const measure = () => {
      const childElements = Array.from(content.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      );
      const naturalHeight =
        childElements.reduce(
          (total, child) => total + child.getBoundingClientRect().height,
          0,
        ) + BASE_SHELF_GAP * Math.max(childElements.length - 1, 0);
      const viewportHeight = viewport.clientHeight;
      const overflowAmount = naturalHeight - viewportHeight;
      const maxScrollTop = Math.max(viewport.scrollHeight - viewportHeight, 0);
      const nextCanScrollUp = viewport.scrollTop > SCROLL_THRESHOLD;
      const nextCanScrollDown =
        maxScrollTop - viewport.scrollTop > SCROLL_THRESHOLD;
      const nextDistributedGap =
        overflowAmount > SCROLL_THRESHOLD || childElements.length <= 1
          ? BASE_SHELF_GAP
          : BASE_SHELF_GAP +
            Math.max(viewportHeight - naturalHeight, 0) /
              (childElements.length - 1);

      setState((current) => {
        if (
          current.canScrollDown === nextCanScrollDown &&
          current.canScrollUp === nextCanScrollUp &&
          Math.abs(current.distributedGap - nextDistributedGap) < 0.5
        ) {
          return current;
        }

        return {
          canScrollDown: nextCanScrollDown,
          canScrollUp: nextCanScrollUp,
          distributedGap: nextDistributedGap,
        };
      });
    };

    measure();

    const handleScroll = () => {
      measure();
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    resizeObserver.observe(viewport);
    resizeObserver.observe(content);

    for (const child of Array.from(content.children)) {
      if (child instanceof HTMLElement) {
        resizeObserver.observe(child);
      }
    }

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [contentCount]);

  return {
    scrollRootRef,
    contentRef,
    ...state,
  };
}
