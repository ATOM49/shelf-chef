"use client";

import { useState, useTransition } from "react";
import { generateId } from "@/lib/id";
import { parseStockingText } from "@/lib/stocking/parse";
import type { StockedItem, StockingDraft } from "@/lib/stocking/types";
import type { StockingItemDraft } from "@/lib/appState";
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/lib/inventory/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Step = "input" | "preview";

type StockingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (items: StockingItemDraft[]) => void;
};

// ─── Local draft row (manual table in input step) ─────────────────────────────

type DraftRow = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
};

function emptyDraftRow(): DraftRow {
  return { id: generateId(), name: "", quantity: "", unit: "" };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StockingDialog({ open, onOpenChange, onCommit }: StockingDialogProps) {
  const [step, setStep] = useState<Step>("input");

  // Input step state
  const [freeText, setFreeText] = useState("");
  const [manualRows, setManualRows] = useState<DraftRow[]>([emptyDraftRow()]);

  // Preview step state
  const [stockedItems, setStockedItems] = useState<StockedItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep("input");
      setFreeText("");
      setManualRows([emptyDraftRow()]);
      setStockedItems([]);
      setApiError(null);
    }, 300);
  };

  // ─── Build the combined draft list from both inputs ──────────────────────────
  const collectDrafts = (): StockingDraft[] => {
    const fromText = parseStockingText(freeText);
    const fromTable: StockingDraft[] = manualRows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        quantity: r.quantity ? parseFloat(r.quantity) || undefined : undefined,
        unit: r.unit.trim() || undefined,
      }));
    return [...fromText, ...fromTable];
  };

  // ─── Call AI ─────────────────────────────────────────────────────────────────
  const handleAnalyze = () => {
    const drafts = collectDrafts();
    if (drafts.length === 0) return;

    setApiError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: drafts }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { items: StockedItem[] };
        // Assign stable local IDs for React keys
        setStockedItems(data.items.map((item) => ({ ...item, id: generateId() })));
        setStep("preview");
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  };

  // ─── Commit enriched items ────────────────────────────────────────────────────
  const handleCommit = () => {
    const drafts: StockingItemDraft[] = stockedItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      storageType: item.storageType,
      shelfName: item.shelfName,
      expiresAt: item.expiresAt || undefined,
    }));
    onCommit(drafts);
    handleClose();
  };

  // ─── Update a single stocked-item field ──────────────────────────────────────
  const updateStockedItem = <K extends keyof StockedItem>(
    id: string,
    field: K,
    value: StockedItem[K],
  ) => {
    setStockedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value, flagged: false } : item)),
    );
  };

  const draftCount = collectDrafts().length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-[min(64rem,calc(100vw-2rem))] max-h-[min(92svh,900px)] overflow-y-auto"
      >
        {step === "input" ? (
          <InputStep
            freeText={freeText}
            onFreeTextChange={setFreeText}
            manualRows={manualRows}
            onManualRowsChange={setManualRows}
            draftCount={draftCount}
            isPending={isPending}
            apiError={apiError}
            onAnalyze={handleAnalyze}
            onClose={handleClose}
          />
        ) : (
          <PreviewStep
            items={stockedItems}
            onUpdateItem={updateStockedItem}
            onBack={() => setStep("input")}
            onCommit={handleCommit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 1: Input ────────────────────────────────────────────────────────────

type InputStepProps = {
  freeText: string;
  onFreeTextChange: (v: string) => void;
  manualRows: DraftRow[];
  onManualRowsChange: (rows: DraftRow[]) => void;
  draftCount: number;
  isPending: boolean;
  apiError: string | null;
  onAnalyze: () => void;
  onClose: () => void;
};

function InputStep({
  freeText,
  onFreeTextChange,
  manualRows,
  onManualRowsChange,
  draftCount,
  isPending,
  apiError,
  onAnalyze,
  onClose,
}: InputStepProps) {
  const updateRow = (id: string, field: keyof DraftRow, value: string) => {
    onManualRowsChange(manualRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const removeRow = (id: string) => {
    const next = manualRows.filter((r) => r.id !== id);
    onManualRowsChange(next.length > 0 ? next : [emptyDraftRow()]);
  };

  const addRow = () => {
    onManualRowsChange([...manualRows, emptyDraftRow()]);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Stock up your kitchen</DialogTitle>
        <DialogDescription>
          Enter items in any format. The AI will fill in category, storage location, shelf, and
          expiry date.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-6 pt-2">
        {/* Free-form textarea */}
        <div className="grid gap-1.5">
          <Label htmlFor="stock-freetext">Items (one per line)</Label>
          <Textarea
            id="stock-freetext"
            rows={6}
            placeholder={"3 eggs\n2 kg rice\n500ml milk\nolive oil\ngaram masala"}
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Supported formats: <code>3 eggs</code>, <code>2 kg rice</code>, <code>500ml milk</code>, <code>milk</code>
          </p>
        </div>

        {/* Manual row table */}
        <div className="grid gap-2">
          <Label>Or add items manually</Label>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-24">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-24">Unit</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {manualRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-2 py-1">
                      <Input
                        value={row.name}
                        placeholder="e.g. Eggs"
                        onChange={(e) => updateRow(row.id, "name", e.target.value)}
                        className="h-8 border-transparent shadow-none focus-visible:border-ring"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={row.quantity}
                        placeholder="e.g. 6"
                        onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                        className="h-8 border-transparent shadow-none focus-visible:border-ring"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={row.unit}
                        placeholder="e.g. count"
                        onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                        className="h-8 border-transparent shadow-none focus-visible:border-ring"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors text-xs"
                        aria-label="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-fit">
            + Add row
          </Button>
        </div>

        {/* Error */}
        {apiError ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {apiError}
          </p>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {draftCount > 0 ? `${draftCount} item${draftCount !== 1 ? "s" : ""} ready to analyse` : "No items yet"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={draftCount === 0 || isPending} onClick={onAnalyze}>
              {isPending ? "Analysing…" : `Analyse with AI →`}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Step 2: Preview ──────────────────────────────────────────────────────────

type PreviewStepProps = {
  items: StockedItem[];
  onUpdateItem: <K extends keyof StockedItem>(id: string, field: K, value: StockedItem[K]) => void;
  onBack: () => void;
  onCommit: () => void;
};

function PreviewStep({ items, onUpdateItem, onBack, onCommit }: PreviewStepProps) {
  const flaggedCount = items.filter((i) => i.flagged).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Review AI suggestions</DialogTitle>
        <DialogDescription>
          {flaggedCount > 0
            ? `${flaggedCount} item${flaggedCount !== 1 ? "s" : ""} flagged for review (highlighted in amber). Edit any field before adding to inventory.`
            : "All items filled in. Edit any field before adding to inventory."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 pt-2">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Qty</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-24">Unit</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Category</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-24">Storage</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-36">Shelf</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Expires</th>
                <th className="px-3 py-2 w-6" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <PreviewRow key={item.id} item={item} onUpdate={onUpdateItem} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={onBack}>
            ← Back
          </Button>
          <Button type="button" disabled={items.length === 0} onClick={onCommit}>
            Add {items.length} item{items.length !== 1 ? "s" : ""} to inventory
          </Button>
        </div>
      </div>
    </>
  );
}

type PreviewRowProps = {
  item: StockedItem;
  onUpdate: <K extends keyof StockedItem>(id: string, field: K, value: StockedItem[K]) => void;
};

function PreviewRow({ item, onUpdate }: PreviewRowProps) {
  const rowCls = item.flagged
    ? "border-t bg-amber-50"
    : "border-t";

  return (
    <tr className={rowCls}>
      <td className="px-2 py-1">
        <Input
          value={item.name}
          onChange={(e) => onUpdate(item.id, "name", e.target.value)}
          className="h-8 min-w-[8rem] border-transparent shadow-none focus-visible:border-ring"
        />
      </td>
      <td className="px-2 py-1">
        <Input
          type="number"
          min={0}
          step="any"
          value={item.quantity}
          onChange={(e) => onUpdate(item.id, "quantity", parseFloat(e.target.value) || 0)}
          className="h-8 border-transparent shadow-none focus-visible:border-ring"
        />
      </td>
      <td className="px-2 py-1">
        <Select
          value={item.unit}
          onValueChange={(v) => onUpdate(item.id, "unit", v as StockedItem["unit"])}
        >
          <SelectTrigger className="h-8 border-transparent shadow-none focus:ring-0 focus-visible:border-ring">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVENTORY_UNITS.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1">
        <Select
          value={item.category}
          onValueChange={(v) => onUpdate(item.id, "category", v as StockedItem["category"])}
        >
          <SelectTrigger className="h-8 border-transparent shadow-none focus:ring-0 focus-visible:border-ring">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVENTORY_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1">
        <Select
          value={item.storageType}
          onValueChange={(v) => onUpdate(item.id, "storageType", v as StockedItem["storageType"])}
        >
          <SelectTrigger className="h-8 border-transparent shadow-none focus:ring-0 focus-visible:border-ring">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fridge">🧊 Fridge</SelectItem>
            <SelectItem value="pantry">🗄️ Pantry</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1">
        <Input
          value={item.shelfName}
          onChange={(e) => onUpdate(item.id, "shelfName", e.target.value)}
          className="h-8 border-transparent shadow-none focus-visible:border-ring"
        />
      </td>
      <td className="px-2 py-1">
        <Input
          type="date"
          value={item.expiresAt ?? ""}
          onChange={(e) => onUpdate(item.id, "expiresAt", e.target.value || undefined)}
          className="h-8 border-transparent shadow-none focus-visible:border-ring"
        />
      </td>
      <td className="px-2 py-1 text-center">
        {item.flagged ? (
          <span title="Flagged for review" className="text-amber-500 text-sm">⚠</span>
        ) : null}
      </td>
    </tr>
  );
}
