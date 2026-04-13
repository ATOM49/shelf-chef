"use client";

import React, { useState } from "react";
import type { FridgeLayout, FridgeAction, FridgeItem } from "../types";

type FridgeInspectorProps = {
  layout: FridgeLayout;
  selectedShelfId?: string;
  selectedCell?: { shelfId: string; cellId: string };
  dispatch: React.Dispatch<FridgeAction>;
  onClearSelection: () => void;
};

export function FridgeInspector({
  layout,
  selectedShelfId,
  selectedCell,
  dispatch,
  onClearSelection,
}: FridgeInspectorProps) {
  const selectedShelf = layout.shelves.find((s) => s.id === selectedShelfId);

  // --- No selection: fridge-level controls ---
  if (!selectedShelf) {
    return (
      <FridgeSettings
        fridgeName={layout.name}
        onUpdateName={(name) => dispatch({ type: "UPDATE_FRIDGE_NAME", name })}
        onAddShelf={() => dispatch({ type: "ADD_SHELF" })}
      />
    );
  }

  // --- Shelf selected, no cell: shelf editor ---
  if (!selectedCell || selectedCell.shelfId !== selectedShelfId) {
    return (
      <ShelfEditor
        key={selectedShelf.id}
        shelf={selectedShelf}
        onUpdateName={(name) =>
          dispatch({
            type: "UPDATE_SHELF",
            shelfId: selectedShelf.id,
            patch: { name },
          })
        }
        onResize={(rows, cols) =>
          dispatch({
            type: "RESIZE_SHELF",
            shelfId: selectedShelf.id,
            rows,
            cols,
          })
        }
        onUpdateHeight={(height) =>
          dispatch({
            type: "UPDATE_SHELF",
            shelfId: selectedShelf.id,
            patch: { height },
          })
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

  // --- Cell selected: item editor ---
  const cellItems = selectedShelf.items.filter(
    (i) => i.cellId === selectedCell.cellId
  );

  return (
    <CellItemEditor
      key={selectedCell.cellId}
      shelfName={selectedShelf.name}
      cellId={selectedCell.cellId}
      cellItems={cellItems}
      onAddItem={(item) =>
        dispatch({ type: "ADD_ITEM", shelfId: selectedCell.shelfId, item })
      }
      onUpdateItem={(itemId, patch) =>
        dispatch({
          type: "UPDATE_ITEM",
          shelfId: selectedCell.shelfId,
          itemId,
          patch,
        })
      }
      onRemoveItem={(itemId) =>
        dispatch({
          type: "REMOVE_ITEM",
          shelfId: selectedCell.shelfId,
          itemId,
        })
      }
      onClearSelection={onClearSelection}
    />
  );
}

// ─── Fridge Settings ──────────────────────────────────────────────────────────

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
      <Section title="Fridge Settings">
        <Field label="Fridge name">
          <input
            type="text"
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim()) onUpdateName(name.trim()); }}
          />
        </Field>
      </Section>
      <Section title="Shelves">
        <p className="text-sm text-zinc-500">
          Click a shelf on the fridge to select it, or add a new one.
        </p>
        <button type="button" onClick={onAddShelf} className={primaryBtn}>
          + Add Shelf
        </button>
      </Section>
    </div>
  );
}

// ─── Shelf Editor ─────────────────────────────────────────────────────────────

type ShelfEditorProps = {
  shelf: { id: string; name: string; rows: number; cols: number; height: number };
  onUpdateName: (name: string) => void;
  onResize: (rows: number, cols: number) => void;
  onUpdateHeight: (height: number) => void;
  onAddShelf: () => void;
  onDeleteShelf: () => void;
  onClearSelection: () => void;
};

function ShelfEditor({
  shelf,
  onUpdateName,
  onResize,
  onUpdateHeight,
  onAddShelf,
  onDeleteShelf,
  onClearSelection,
}: ShelfEditorProps) {
  const [name, setName] = useState(shelf.name);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-800">Shelf Settings</h3>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ✕ Deselect
        </button>
      </div>

      <Section title="Name">
        <input
          type="text"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim()) onUpdateName(name.trim()); }}
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
              onChange={(e) =>
                onResize(Math.max(1, parseInt(e.target.value) || 1), shelf.cols)
              }
            />
          </Field>
          <Field label="Columns">
            <input
              type="number"
              min={1}
              max={8}
              className={inputCls}
              value={shelf.cols}
              onChange={(e) =>
                onResize(shelf.rows, Math.max(1, parseInt(e.target.value) || 1))
              }
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
            onChange={(e) => onUpdateHeight(parseInt(e.target.value))}
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

// ─── Cell Item Editor ─────────────────────────────────────────────────────────

type ItemFormState = {
  name: string;
  quantity: string;
  unit: string;
  category: FridgeItem["category"] | "";
  expiresAt: string;
  notes: string;
};

const EMPTY_ITEM_FORM: ItemFormState = {
  name: "",
  quantity: "",
  unit: "",
  category: "",
  expiresAt: "",
  notes: "",
};

const CATEGORIES: NonNullable<FridgeItem["category"]>[] = [
  "vegetable",
  "fruit",
  "dairy",
  "meat",
  "drink",
  "leftover",
  "condiment",
  "other",
];

type CellItemEditorProps = {
  shelfName: string;
  cellId: string;
  cellItems: FridgeItem[];
  onAddItem: (item: FridgeItem) => void;
  onUpdateItem: (itemId: string, patch: Partial<FridgeItem>) => void;
  onRemoveItem: (itemId: string) => void;
  onClearSelection: () => void;
};

function CellItemEditor({
  shelfName,
  cellId,
  cellItems,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onClearSelection,
}: CellItemEditorProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);

  const cellCoords = cellId.split("-");

  const handleSave = () => {
    if (!form.name.trim()) return;
    const parsed = parseFloat(form.quantity);
    const base = {
      name: form.name.trim(),
      quantity: isNaN(parsed) ? undefined : parsed,
      unit: form.unit.trim() || undefined,
      category: (form.category as FridgeItem["category"]) || undefined,
      expiresAt: form.expiresAt || undefined,
      notes: form.notes.trim() || undefined,
      cellId,
    };

    if (editingItemId) {
      onUpdateItem(editingItemId, base);
    } else {
      onAddItem({ ...base, id: crypto.randomUUID() });
    }
    setForm(EMPTY_ITEM_FORM);
    setEditingItemId(null);
  };

  const handleEdit = (item: FridgeItem) => {
    setEditingItemId(item.id);
    setForm({
      name: item.name,
      quantity: item.quantity?.toString() ?? "",
      unit: item.unit ?? "",
      category: item.category ?? "",
      expiresAt: item.expiresAt ?? "",
      notes: item.notes ?? "",
    });
  };

  const handleRemove = (itemId: string) => {
    onRemoveItem(itemId);
    if (editingItemId === itemId) {
      setEditingItemId(null);
      setForm(EMPTY_ITEM_FORM);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-800">
          {shelfName}{" "}
          <span className="text-zinc-400 text-sm font-normal">
            — r{cellCoords[1]} c{cellCoords[2]}
          </span>
        </h3>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ✕ Deselect
        </button>
      </div>

      {cellItems.length > 0 && (
        <Section title="Items in this cell">
          <div className="flex flex-col gap-2">
            {cellItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
              >
                <div>
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.quantity != null && (
                    <span className="ml-1 text-xs text-zinc-500">
                      {item.quantity}
                      {item.unit}
                    </span>
                  )}
                  {item.category && (
                    <span className="ml-2 text-xs text-zinc-400 capitalize">
                      {item.category}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={editingItemId ? "Edit Item" : "Add Item"}>
        <Field label="Name *">
          <input
            type="text"
            className={inputCls}
            placeholder="e.g. Milk"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Quantity">
            <input
              type="number"
              min={0}
              step="any"
              className={inputCls}
              placeholder="e.g. 2"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </Field>
          <Field label="Unit">
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. L"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Category">
          <select
            className={inputCls}
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                category: e.target.value as FridgeItem["category"] | "",
              }))
            }
          >
            <option value="">None</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expires">
          <input
            type="date"
            className={inputCls}
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
          />
        </Field>
        <Field label="Notes">
          <textarea
            rows={2}
            className={inputCls}
            placeholder="Optional notes..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Field>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={!form.name.trim()}
            onClick={handleSave}
            className={
              primaryBtn +
              " flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            }
          >
            {editingItemId ? "Update Item" : "Add Item"}
          </button>
          {editingItemId && (
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
          )}
        </div>
      </Section>
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors";
const secondaryBtn =
  "rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors";
const dangerBtn =
  "rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors border border-red-200";

