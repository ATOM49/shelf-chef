"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppAction } from "@/lib/appState";
import type { FridgeLayout, StorageLayout } from "@/lib/fridge/types";
import {
  CATEGORY_COLORS,
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  type InventoryCategory,
  type InventoryItem,
  type InventoryUnit,
} from "@/lib/inventory/types";

type ShelfOption = {
  storageId: string;
  shelfId: string;
  firstCellId: string;
  label: string;
};

function buildShelfOptions(fridge: FridgeLayout, pantry: StorageLayout): ShelfOption[] {
  return [
    ...fridge.shelves.map((shelf) => ({
      storageId: fridge.id,
      shelfId: shelf.id,
      firstCellId: shelf.cells[0]?.id ?? "cell-0-0",
      label: `${fridge.name} › ${shelf.name}`,
    })),
    ...pantry.shelves.map((shelf) => ({
      storageId: pantry.id,
      shelfId: shelf.id,
      firstCellId: shelf.cells[0]?.id ?? "cell-0-0",
      label: `${pantry.name} › ${shelf.name}`,
    })),
  ];
}

function pickRandomShelf(options: ShelfOption[]): ShelfOption | undefined {
  if (options.length === 0) return undefined;
  return options[Math.floor(Math.random() * options.length)];
}

type ItemFormState = {
  name: string;
  quantity: string;
  unit: InventoryUnit;
  category: InventoryCategory;
  expiresAt: string;
};

const EMPTY_FORM: ItemFormState = {
  name: "",
  quantity: "1",
  unit: "count",
  category: "other",
  expiresAt: "",
};

type InventoryListPanelProps = {
  inventory: InventoryItem[];
  fridge: FridgeLayout;
  pantry: StorageLayout;
  dispatch: React.Dispatch<AppAction>;
};

type FilterTab = "all" | "fridge" | "pantry";

export function InventoryListPanel({
  inventory,
  fridge,
  pantry,
  dispatch,
}: InventoryListPanelProps) {
  const shelfOptions = buildShelfOptions(fridge, pantry);

  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [addForm, setAddForm] = useState<ItemFormState>(EMPTY_FORM);
  // editingItem holds the full InventoryItem so we can preserve its shelf location on save
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState<ItemFormState>(EMPTY_FORM);

  const filteredInventory = inventory.filter((item) => {
    if (filterTab === "fridge") return item.storageId === fridge.id;
    if (filterTab === "pantry") return item.storageId === pantry.id;
    return true;
  });

  const handleAdd = () => {
    if (!addForm.name.trim()) return;
    const shelf = pickRandomShelf(shelfOptions);
    if (!shelf) return;

    dispatch({
      type: "ADD_INVENTORY_ITEM",
      item: {
        name: addForm.name.trim(),
        quantity: Math.max(0, Number(addForm.quantity) || 0),
        unit: addForm.unit,
        category: addForm.category,
        storageId: shelf.storageId,
        shelfId: shelf.shelfId,
        cellId: shelf.firstCellId,
        expiresAt: addForm.expiresAt || undefined,
      },
    });
    setAddForm(EMPTY_FORM);
  };

  const handleEditStart = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      quantity: item.quantity.toString(),
      unit: item.unit,
      category: item.category,
      expiresAt: item.expiresAt ?? "",
    });
  };

  const handleEditSave = () => {
    if (!editingItem || !editForm.name.trim()) return;

    dispatch({
      type: "UPDATE_INVENTORY_ITEM",
      itemId: editingItem.id,
      patch: {
        name: editForm.name.trim(),
        quantity: Math.max(0, Number(editForm.quantity) || 0),
        unit: editForm.unit,
        category: editForm.category,
        // preserve the item's existing shelf/cell assignment
        storageId: editingItem.storageId,
        shelfId: editingItem.shelfId,
        cellId: editingItem.cellId,
        expiresAt: editForm.expiresAt || undefined,
      },
    });
    setEditingItem(null);
  };

  const handleEditCancel = () => {
    setEditingItem(null);
  };

  const handleDelete = (itemId: string) => {
    dispatch({ type: "REMOVE_INVENTORY_ITEM", itemId });
    if (editingItem?.id === itemId) setEditingItem(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["all", "fridge", "pantry"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-label={tab === "all" ? "Show all items" : tab === "fridge" ? "Show fridge items" : "Show pantry items"}
            onClick={() => setFilterTab(tab)}
            className={[
              "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
              filterTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab === "fridge" ? "🧊 " : tab === "pantry" ? "🗄️ " : ""}
            {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Quick-add form */}
      <div className="rounded-xl border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add item
        </p>
        <ItemForm
          form={addForm}
          onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
          onSubmit={handleAdd}
          submitLabel="+ Add"
        />
      </div>

      {/* Item count */}
      <p className="text-xs text-muted-foreground">
        {filteredInventory.length === 0
          ? "No items yet."
          : `${filteredInventory.length} item${filteredInventory.length === 1 ? "" : "s"}`}
      </p>

      {/* Items list */}
      {filteredInventory.length > 0 && (
        <div className="flex flex-col gap-2">
          {filteredInventory.map((item) =>
            editingItem?.id === item.id ? (
              <div key={item.id} className="rounded-xl border bg-card p-3">
                <ItemForm
                  form={editForm}
                  onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                  onSubmit={handleEditSave}
                  onCancel={handleEditCancel}
                  submitLabel="Save"
                />
              </div>
            ) : (
              <InventoryRow
                key={item.id}
                item={item}
                locationLabel={
                  shelfOptions.find(
                    (o) => o.storageId === item.storageId && o.shelfId === item.shelfId,
                  )?.label ?? "—"
                }
                onEdit={() => handleEditStart(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

function InventoryRow({
  item,
  locationLabel,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  locationLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
      <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{item.name}</span>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${CATEGORY_COLORS[item.category]}`}
          >
            {item.category}
          </span>
        </div>
        <span className="text-sm text-muted-foreground text-right tabular-nums">
          {item.quantity} {item.unit}
        </span>
        <span className="text-xs text-muted-foreground truncate">{locationLabel}</span>
        {item.expiresAt ? (
          <span className="text-xs text-muted-foreground text-right">Exp {item.expiresAt}</span>
        ) : (
          <span />
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
          ✕
        </Button>
      </div>
    </div>
  );
}

// ─── Item Form (shared add/edit) ──────────────────────────────────────────────

function ItemForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: ItemFormState;
  onChange: (patch: Partial<ItemFormState>) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  return (
    <div className="grid gap-2">
      {/* Row 1: Name | Qty | Unit */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div className="grid gap-1">
          <Label className="text-xs">Name *</Label>
          <Input
            placeholder="e.g. Eggs"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
          />
        </div>
        <div className="grid gap-1 w-20">
          <Label className="text-xs">Qty</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={form.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </div>
        <div className="grid gap-1 w-24">
          <Label className="text-xs">Unit</Label>
          <Select value={form.unit} onValueChange={(v) => onChange({ unit: v as InventoryUnit })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVENTORY_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Category | Expires — stacked on mobile, side-by-side on sm+ */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label className="text-xs">Category</Label>
          <Select
            value={form.category}
            onValueChange={(v) => onChange({ category: v as InventoryCategory })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVENTORY_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Expires</Label>
          <Input
            type="date"
            className="w-full"
            value={form.expiresAt}
            onChange={(e) => onChange({ expiresAt: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" disabled={!form.name.trim()} onClick={onSubmit}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
