"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { AppAction } from "@/lib/appState";
import type { StorageLayout } from "@/lib/fridge/types";

type StorageEditorPanelProps = {
  storage: StorageLayout;
  selectedShelfId?: string;
  dispatch: React.Dispatch<AppAction>;
  onClearSelection: () => void;
  showInlinePanel?: boolean;
};

export function StorageEditorPanel({
  storage,
  selectedShelfId,
  dispatch,
  onClearSelection,
  showInlinePanel = true,
}: StorageEditorPanelProps) {
  const selectedShelf = storage.shelves.find((shelf) => shelf.id === selectedShelfId);
  const isShelfPopupOpen = Boolean(selectedShelf);

  return (
    <>
      {showInlinePanel ? (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {storage.storageType === "pantry" ? "Pantry" : "Fridge"} Controls
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a shelf to edit its layout.
          </p>
          <Button
            type="button"
            className="mt-3"
            onClick={() => dispatch({ type: "ADD_SHELF", target: storage.storageType })}
          >
            + Add Shelf
          </Button>
        </div>
      ) : null}

      {selectedShelf ? (
        <Dialog
          open={isShelfPopupOpen}
          onOpenChange={(open) => {
            if (!open) onClearSelection();
          }}
        >
          <DialogContent
            className="w-full max-w-[min(44rem,calc(100vw-2rem))] max-h-[min(90svh,800px)] overflow-y-auto"
          >
            <DialogDescription className="text-xs">
              Edit shelf grid and dimensions without changing inventory behavior.
            </DialogDescription>
            <ShelfEditor
              key={selectedShelf.id}
              shelf={selectedShelf}
              onClose={onClearSelection}
              onUpdateName={(name) =>
                dispatch({ type: "UPDATE_SHELF", shelfId: selectedShelf.id, patch: { name } })
              }
              onResize={(rows, cols) =>
                dispatch({ type: "RESIZE_SHELF", shelfId: selectedShelf.id, rows, cols })
              }
              onUpdateHeight={(height) =>
                dispatch({ type: "UPDATE_SHELF", shelfId: selectedShelf.id, patch: { height } })
              }
              onAddShelf={() => dispatch({ type: "ADD_SHELF", target: storage.storageType })}
              onDeleteShelf={() => {
                dispatch({ type: "REMOVE_SHELF", shelfId: selectedShelf.id });
                onClearSelection();
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function ShelfEditor({
  shelf,
  onUpdateName,
  onResize,
  onUpdateHeight,
  onAddShelf,
  onDeleteShelf,
  onClose,
}: {
  shelf: StorageLayout["shelves"][number];
  onUpdateName: (name: string) => void;
  onResize: (rows: number, cols: number) => void;
  onUpdateHeight: (height: number) => void;
  onAddShelf: () => void;
  onDeleteShelf: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(shelf.name);

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Label htmlFor="shelf-name" className="mb-1 text-xs text-muted-foreground">
            Shelf name
          </Label>
          <Input
            id="shelf-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => name.trim() && onUpdateName(name.trim())}
            className="h-9 border-transparent bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:border-ring"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="shelf-rows">Rows</Label>
          <Input
            id="shelf-rows"
            type="number"
            min={1}
            max={6}
            value={shelf.rows}
            onChange={(event) => onResize(Math.max(1, Number(event.target.value) || 1), shelf.cols)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="shelf-cols">Columns</Label>
          <Input
            id="shelf-cols"
            type="number"
            min={1}
            max={8}
            value={shelf.cols}
            onChange={(event) => onResize(shelf.rows, Math.max(1, Number(event.target.value) || 1))}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Height</Label>
          <span className="text-sm text-muted-foreground">{shelf.height}px</span>
        </div>
        <Slider
          min={80}
          max={240}
          step={10}
          value={[shelf.height]}
          onValueChange={(value) => {
            const nextValue = Array.isArray(value) ? value[0] : value;
            if (typeof nextValue === "number") {
              onUpdateHeight(nextValue);
            }
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onAddShelf}>
          + Add Shelf
        </Button>
        <Button type="button" variant="destructive" onClick={onDeleteShelf}>
          Delete Shelf
        </Button>
      </div>
    </div>
  );
}
