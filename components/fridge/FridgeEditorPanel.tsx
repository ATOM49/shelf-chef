"use client";

import { useState } from "react";
import type { AppAction } from "@/lib/appState";
import type { FridgeLayout } from "@/lib/fridge/types";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  type InventoryCategory,
  type InventoryItem,
  type InventoryUnit,
} from "@/lib/inventory/types";

type FridgeEditorPanelProps = {
  layout: FridgeLayout;
  inventory: InventoryItem[];
  selectedShelfId?: string;
  selectedCell?: { shelfId: string; cellId: string };
  dispatch: React.Dispatch<AppAction>;
  onClearSelection: () => void;
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

export function FridgeEditorPanel({
  layout,
  inventory,
  selectedShelfId,
  selectedCell,
  dispatch,
  onClearSelection,
}: FridgeEditorPanelProps) {
  const selectedShelf = layout.shelves.find((shelf) => shelf.id === selectedShelfId);

  if (!selectedShelf) {
    return (
      <FridgeSettings
        fridgeName={layout.name}
        onUpdateName={(name) => dispatch({ type: "UPDATE_FRIDGE_NAME", name })}
        onAddShelf={() => dispatch({ type: "ADD_SHELF" })}
      />
    );
  }

  if (!selectedCell || selectedCell.shelfId !== selectedShelf.id) {
    return (
      <ShelfEditor
        shelf={selectedShelf}
        onUpdateName={(name) =>
          dispatch({ type: "UPDATE_SHELF", shelfId: selectedShelf.id, patch: { name } })
        }
        onResize={(rows, cols) => dispatch({ type: "RESIZE_SHELF", shelfId: selectedShelf.id, rows, cols })}
        onUpdateHeight={(height) =>
          dispatch({ type: "UPDATE_SHELF", shelfId: selectedShelf.id, patch: { height } })
        }
        onAddShelf={() => dispatch({ type: "ADD_SHELF" })}
        onDeleteShelf={() => {
          dispatch({ type: "REMOVE_SHELF", shelfId: selectedShelf.id });
          onClearSelection();
        }}
        onClearSelection={onClearSelection}
      />
    );
  }

  return (
    <CellInventoryEditor
      shelfName={selectedShelf.name}
      cellId={selectedCell.cellId}
      cellItems={inventory.filter((item) => item.shelfId === selectedShelf.id && item.cellId === selectedCell.cellId)}
      onAddItem={(item) => dispatch({ type: "ADD_INVENTORY_ITEM", item })}
      onUpdateItem={(itemId, patch) => dispatch({ type: "UPDATE_INVENTORY_ITEM", itemId, patch })}
      onRemoveItem={(itemId) => dispatch({ type: "REMOVE_INVENTORY_ITEM", itemId })}
      shelfId={selectedShelf.id}
      onClearSelection={onClearSelection}
    />
  );
}

function FridgeSettings({
  fridgeName,
  onUpdateName,
  onAddShelf,
}: {
  fridgeName: string;
  onUpdateName: (name: string) => void;
  onAddShelf: () => void;
}) {
  const [name, setName] = useState(fridgeName);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Fridge settings">
        <Field label="Fridge name">
          <input
            type="text"
            className={inputCls}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => name.trim() && onUpdateName(name.trim())}
          />
        </Field>
      </Section>
      <Section title="Shelves">
        <p className="text-sm text-zinc-500">Select a shelf in the fridge to edit it, or add a new shelf.</p>
        <button type="button" onClick={onAddShelf} className={primaryBtn}>
          + Add Shelf
        </button>
      </Section>
    </div>
  );
}

function ShelfEditor({
  shelf,
  onUpdateName,
  onResize,
  onUpdateHeight,
  onAddShelf,
  onDeleteShelf,
  onClearSelection,
}: {
  shelf: FridgeLayout["shelves"][number];
  onUpdateName: (name: string) => void;
  onResize: (rows: number, cols: number) => void;
  onUpdateHeight: (height: number) => void;
  onAddShelf: () => void;
  onDeleteShelf: () => void;
  onClearSelection: () => void;
}) {
  const [name, setName] = useState(shelf.name);

  return (
    <div className="flex flex-col gap-6">
      <Header title="Shelf settings" onClearSelection={onClearSelection} />
      <Section title="Name">
        <input
          type="text"
          className={inputCls}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && onUpdateName(name.trim())}
        />
      </Section>
      <Section title="Grid">
        <div className="flex gap-4">
          <Field label="Rows">
            <input
              type="number"
              min={1}
              max={6}
              className={inputCls}
              value={shelf.rows}
              onChange={(event) => onResize(Math.max(1, Number(event.target.value) || 1), shelf.cols)}
            />
          </Field>
          <Field label="Columns">
            <input
              type="number"
              min={1}
              max={8}
              className={inputCls}
              value={shelf.cols}
              onChange={(event) => onResize(shelf.rows, Math.max(1, Number(event.target.value) || 1))}
            />
          </Field>
        </div>
      </Section>
      <Section title="Height">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={80}
            max={240}
            step={10}
            className="flex-1"
            value={shelf.height}
            onChange={(event) => onUpdateHeight(Number(event.target.value))}
          />
          <span className="w-12 text-sm text-zinc-500">{shelf.height}px</span>
        </div>
      </Section>
      <Section title="Actions">
        <button type="button" onClick={onAddShelf} className={primaryBtn}>
          + Add Shelf
        </button>
        <button type="button" onClick={onDeleteShelf} className={dangerBtn}>
          Delete Shelf
        </button>
      </Section>
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
  shelfId,
  onClearSelection,
}: {
  shelfName: string;
  cellId: string;
  cellItems: InventoryItem[];
  onAddItem: (item: {
    name: string;
    quantity: number;
    unit: InventoryUnit;
    category: InventoryCategory;
    shelfId: string;
    cellId: string;
    expiresAt?: string;
  }) => void;
  onUpdateItem: (itemId: string, patch: Partial<{
    name: string;
    quantity: number;
    unit: InventoryUnit;
    category: InventoryCategory;
    shelfId: string;
    cellId: string;
    expiresAt?: string;
  }>) => void;
  onRemoveItem: (itemId: string) => void;
  shelfId: string;
  onClearSelection: () => void;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);
  const cellCoords = cellId.split("-");

  const handleSave = () => {
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      quantity: Math.max(0, Number(form.quantity) || 0),
      unit: form.unit,
      category: form.category,
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
    <div className="flex flex-col gap-6">
      <Header
        title={`${shelfName} — r${cellCoords[1]} c${cellCoords[2]}`}
        onClearSelection={onClearSelection}
      />

      {cellItems.length > 0 ? (
        <Section title="Items in this cell">
          <div className="flex flex-col gap-2">
            {cellItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-800">{item.name}</div>
                  <div className="text-xs text-zinc-500">
                    {item.quantity} {item.unit} · {item.category}
                    {item.expiresAt ? ` · exp ${item.expiresAt}` : ""}
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-700">
                    Edit
                  </button>
                  <button type="button" onClick={() => onRemoveItem(item.id)} className="text-red-600 hover:text-red-700">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={editingItemId ? "Edit inventory item" : "Add inventory item"}>
        <Field label="Name">
          <input
            type="text"
            className={inputCls}
            placeholder="e.g. Eggs"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input
              type="number"
              min={0}
              step="any"
              className={inputCls}
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
            />
          </Field>
          <Field label="Unit">
            <select
              className={inputCls}
              value={form.unit}
              onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value as InventoryUnit }))}
            >
              {INVENTORY_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Category">
          <select
            className={inputCls}
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({ ...current, category: event.target.value as InventoryCategory }))
            }
          >
            {INVENTORY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expiry">
          <input
            type="date"
            className={inputCls}
            value={form.expiresAt}
            onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
          />
        </Field>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.name.trim()}
            className={`${primaryBtn} flex-1 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {editingItemId ? "Update item" : "Add item"}
          </button>
          {editingItemId ? (
            <button
              type="button"
              onClick={() => {
                setEditingItemId(null);
                setForm(EMPTY_ITEM_FORM);
              }}
              className={secondaryBtn}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

function Header({ title, onClearSelection }: { title: string; onClearSelection: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h3 className="font-semibold text-zinc-800">{title}</h3>
      <button type="button" onClick={onClearSelection} className="text-xs text-zinc-400 hover:text-zinc-600">
        ✕ Deselect
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400";
const primaryBtn =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700";
const secondaryBtn =
  "rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50";
const dangerBtn =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100";
