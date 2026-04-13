"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { AppAction } from "@/lib/appState";
import type { StorageLayout } from "@/lib/fridge/types";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  type InventoryCategory,
  type InventoryItem,
  type InventoryUnit,
} from "@/lib/inventory/types";

type StorageEditorPanelProps = {
  storage: StorageLayout;
  inventory: InventoryItem[];
  selectedShelfId?: string;
  selectedCell?: { shelfId: string; cellId: string };
  dispatch: React.Dispatch<AppAction>;
  onClearSelection: () => void;
  showInlinePanel?: boolean;
};

type ItemFormState = {
  name: string;
  quantity: string;
  unit: InventoryUnit;
  category: InventoryCategory;
  expiresAt: string;
};

const EMPTY_ITEM_FORM: ItemFormState = {
  name: "",
  quantity: "1",
  unit: "count",
  category: "other",
  expiresAt: "",
};

export function StorageEditorPanel({
  storage,
  inventory,
  selectedShelfId,
  selectedCell,
  dispatch,
  onClearSelection,
  showInlinePanel = true,
}: StorageEditorPanelProps) {
  const selectedShelf = storage.shelves.find((shelf) => shelf.id === selectedShelfId);
  const isShelfPopupOpen = Boolean(
    selectedShelf && (!selectedCell || selectedCell.shelfId !== selectedShelf.id),
  );
  const isCellPopupOpen = Boolean(
    selectedShelf && selectedCell && selectedCell.shelfId === selectedShelf.id,
  );

  return (
    <>
      {showInlinePanel ? (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {storage.storageType === "pantry" ? "Pantry" : "Fridge"} Controls
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a shelf or cell to edit it in a popup.
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
        <Popover
          open={isShelfPopupOpen}
          onOpenChange={(open) => {
            if (!open) onClearSelection();
          }}
        >
          <PopoverTrigger
            aria-hidden
            className="pointer-events-none fixed top-1/2 left-1/2 size-px -translate-x-1/2 -translate-y-1/2 opacity-0"
          />
          <PopoverContent
            sideOffset={0}
            className="w-[min(44rem,calc(100vw-2rem))] max-h-[min(90svh,800px)] overflow-y-auto p-4"
          >
            <PopoverDescription className="mb-3 text-xs">
              Edit shelf grid and dimensions without changing inventory behavior.
            </PopoverDescription>
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
          </PopoverContent>
        </Popover>
      ) : null}

      {selectedShelf && selectedCell ? (
        <Popover
          open={isCellPopupOpen}
          onOpenChange={(open) => {
            if (!open) onClearSelection();
          }}
        >
          <PopoverTrigger
            aria-hidden
            className="pointer-events-none fixed top-1/2 left-1/2 size-px -translate-x-1/2 -translate-y-1/2 opacity-0"
          />
          <PopoverContent
            sideOffset={0}
            className="w-[min(52rem,calc(100vw-2rem))] max-h-[min(90svh,900px)] overflow-y-auto p-4"
          >
            <PopoverHeader className="mb-3 pr-10">
              <PopoverTitle>
                {selectedShelf.name} | {selectedCell.cellId}
              </PopoverTitle>
              <PopoverDescription>
                Add, edit, or remove inventory items mapped to this{" "}
                {storage.storageType === "pantry" ? "pantry" : "fridge"} cell.
              </PopoverDescription>
            </PopoverHeader>
            <CellInventoryEditor
              shelfName={selectedShelf.name}
              cellId={selectedCell.cellId}
              cellItems={inventory.filter(
                (item) =>
                  item.shelfId === selectedShelf.id && item.cellId === selectedCell.cellId,
              )}
              onAddItem={(item) => dispatch({ type: "ADD_INVENTORY_ITEM", item })}
              onUpdateItem={(itemId, patch) =>
                dispatch({ type: "UPDATE_INVENTORY_ITEM", itemId, patch })
              }
              onRemoveItem={(itemId) => dispatch({ type: "REMOVE_INVENTORY_ITEM", itemId })}
              storageId={storage.id}
              shelfId={selectedShelf.id}
              onClose={onClearSelection}
            />
          </PopoverContent>
        </Popover>
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

function CellInventoryEditor({
  shelfName,
  cellId,
  cellItems,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  storageId,
  shelfId,
  onClose,
}: {
  shelfName: string;
  cellId: string;
  cellItems: InventoryItem[];
  onAddItem: (item: {
    name: string;
    quantity: number;
    unit: InventoryUnit;
    category: InventoryCategory;
    storageId: string;
    shelfId: string;
    cellId: string;
    expiresAt?: string;
  }) => void;
  onUpdateItem: (
    itemId: string,
    patch: Partial<{
      name: string;
      quantity: number;
      unit: InventoryUnit;
      category: InventoryCategory;
      storageId: string;
      shelfId: string;
      cellId: string;
      expiresAt?: string;
    }>,
  ) => void;
  onRemoveItem: (itemId: string) => void;
  storageId: string;
  shelfId: string;
  onClose: () => void;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);

  const handleSave = () => {
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      quantity: Math.max(0, Number(form.quantity) || 0),
      unit: form.unit,
      category: form.category,
      storageId,
      shelfId,
      cellId,
      expiresAt: form.expiresAt || undefined,
    };

    if (editingItemId) {
      onUpdateItem(editingItemId, payload);
    } else {
      onAddItem(payload);
    }

    setEditingItemId(null);
    setForm(EMPTY_ITEM_FORM);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setForm({
      name: item.name,
      quantity: item.quantity.toString(),
      unit: item.unit,
      category: item.category,
      expiresAt: item.expiresAt ?? "",
    });
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">{shelfName}</h4>
          <p className="text-xs text-muted-foreground">Editing cell {cellId}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {cellItems.length > 0 ? (
        <div className="grid gap-2">
          <h4 className="text-sm font-semibold">Items in this cell</h4>
          {cellItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium text-foreground">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.quantity} {item.unit} | {item.category}
                  {item.expiresAt ? ` | exp ${item.expiresAt}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(item)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onRemoveItem(item.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3">
        <h4 className="text-sm font-semibold">
          {editingItemId ? "Edit inventory item" : "Add inventory item"}
        </h4>

        <div className="grid gap-1.5">
          <Label htmlFor="item-name">Name</Label>
          <Input
            id="item-name"
            placeholder="e.g. Eggs"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="item-qty">Quantity</Label>
            <Input
              id="item-qty"
              type="number"
              min={0}
              step="any"
              value={form.quantity}
              onChange={(event) =>
                setForm((current) => ({ ...current, quantity: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Unit</Label>
            <Select
              value={form.unit}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, unit: value as InventoryUnit }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, category: value as InventoryCategory }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="item-expiry">Expiry</Label>
            <Input
              id="item-expiry"
              type="date"
              value={form.expiresAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, expiresAt: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" disabled={!form.name.trim()} onClick={handleSave}>
            {editingItemId ? "Update item" : "Add item"}
          </Button>
          {editingItemId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingItemId(null);
                setForm(EMPTY_ITEM_FORM);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
