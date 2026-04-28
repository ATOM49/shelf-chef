"use client";

import { useState } from "react";
import { LoaderCircle, XIcon } from "lucide-react";
import { generateId } from "@/lib/id";
import type { StockingItemDraft } from "@/lib/appState";
import {
  PRESET_METADATA,
  PRESET_ORDER,
  type PresetId,
} from "@/lib/inventory/presets";
import { getAllStapleNames } from "@/lib/inventory/staples";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import { parseStockApiResponseForReview } from "@/lib/stocking/schema";
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/lib/inventory/types";
import type {
  StockApiResponse,
  StockPresetRequest,
  StockedItem,
  StockTextRequest,
} from "@/lib/stocking/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LOTTIE_ANIMATION_SOURCES,
  LottieLoadingPanel,
} from "@/components/ui/lottie-loading-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Textarea } from "@/components/ui/textarea";

type Step = "input" | "preview";
type PendingAction = "text" | PresetId;

type StockingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (items: StockingItemDraft[]) => void;
  customStapleNames?: readonly string[];
};

// ─── Main component ───────────────────────────────────────────────────────────

export function StockingDialog({
  open,
  onOpenChange,
  onCommit,
  customStapleNames = [],
}: StockingDialogProps) {
  const [step, setStep] = useState<Step>("input");
  const [freeText, setFreeText] = useState("");
  const [stockedItems, setStockedItems] = useState<StockedItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [isPending, setIsPending] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("input");
      setFreeText("");
      setStockedItems([]);
      setApiError(null);
      setPendingAction(null);
    }, 300);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (isPending) {
      return;
    }
    handleClose();
  };

  const requestReview = (
    endpoint: string,
    request: StockTextRequest | StockPresetRequest,
    nextPendingAction: PendingAction,
  ) => {
    // Build the full staple list and inject it into the request
    const stapleNames = getAllStapleNames(customStapleNames);
    const stapleSet = new Set(stapleNames.map(normalizeIngredientName));
    const requestWithStaples = { ...request, stapleNames };

    setApiError(null);
    setPendingAction(nextPendingAction);
    setIsPending(true);
    void (async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestWithStaples),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const rawData = (await res.json()) as StockApiResponse;
        const data = parseStockApiResponseForReview(rawData);
        // Client-side safety filter: remove any items that are still staples
        const filtered = data.items.filter(
          (item) => !stapleSet.has(normalizeIngredientName(item.name)),
        );
        setStockedItems(
          filtered.map((item) => ({ ...item, id: generateId() })),
        );
        setStep("preview");
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setPendingAction(null);
        setIsPending(false);
      }
    })();
  };

  const handleAnalyze = () => {
    const input = freeText.trim();
    if (!input) {
      return;
    }

    requestReview("/api/stock", { input }, "text");
  };

  const handlePresetSelect = (presetId: PresetId) => {
    requestReview("/api/stock/preset", { presetId }, presetId);
  };

  const handleCommit = () => {
    const drafts: StockingItemDraft[] = stockedItems.map((item) => ({
      emoji: item.emoji || undefined,
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

  const updateStockedItem = <K extends keyof StockedItem>(
    id: string,
    field: K,
    value: StockedItem[K],
  ) => {
    setStockedItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value, flagged: false } : item,
      ),
    );
  };

  const pendingState = getStockPendingState(pendingAction);

  return (
    <Dialog
      open={open}
      onOpenChange={handleDialogOpenChange}
    >
      <DialogContent
        aria-busy={isPending}
        showCloseButton={false}
        className="w-full max-w-[min(96vw,76rem)] max-h-[min(90svh,800px)] overflow-y-auto p-0"
      >
        <div className="relative flex min-h-0 flex-1 flex-col p-6">
          <div className="absolute right-2 top-2 z-20">
            <DialogClose
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Close stocking dialog"
                  disabled={isPending}
                >
                  <XIcon className="size-4" aria-hidden />
                </Button>
              }
            />
          </div>

          <div
            className={
              isPending
                ? "pointer-events-none select-none opacity-30"
                : undefined
            }
          >
            {step === "input" ? (
              <InputStep
                freeText={freeText}
                onFreeTextChange={setFreeText}
                isPending={isPending}
                pendingAction={pendingAction}
                apiError={apiError}
                onAnalyze={handleAnalyze}
                onSelectPreset={handlePresetSelect}
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
          </div>

          {isPending ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-popover/92 p-4 supports-backdrop-filter:backdrop-blur-sm">
              <LottieLoadingPanel
                src={LOTTIE_ANIMATION_SOURCES.stock}
                title={pendingState.title}
                description={pendingState.description}
                statusLabel={pendingState.statusLabel}
                className="min-h-[28rem]"
                panelClassName="max-w-xl"
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getStockPendingState(pendingAction: PendingAction | null) {
  if (pendingAction === "text") {
    return {
      title: "Reading your stock note",
      description:
        "Pulling out items from your note and suggesting where they belong.",
      statusLabel: "Analyzing stock note",
    };
  }

  if (pendingAction) {
    const presetLabel = PRESET_METADATA[pendingAction].label;

    return {
      title: `Generating the ${presetLabel} preset`,
      description:
        "Building out a kitchen full of items for this preset — almost ready to review!",
      statusLabel: "Generating stock preset",
    };
  }

  return {
    title: "Preparing your stock review",
    description: "Getting your suggestions ready to review.",
    statusLabel: "Preparing review",
  };
}

// ─── Step 1: Input ────────────────────────────────────────────────────────────

type InputStepProps = {
  freeText: string;
  onFreeTextChange: (v: string) => void;
  isPending: boolean;
  pendingAction: PendingAction | null;
  apiError: string | null;
  onAnalyze: () => void;
  onSelectPreset: (presetId: PresetId) => void;
  onClose: () => void;
};

function InputStep({
  freeText,
  onFreeTextChange,
  isPending,
  pendingAction,
  apiError,
  onAnalyze,
  onSelectPreset,
  onClose,
}: InputStepProps) {
  const trimmedInput = freeText.trim();
  const isTextPending = isPending && pendingAction === "text";

  return (
    <>
      <DialogHeader className="px-0 pb-2 pt-0">
        <DialogTitle>Stock up!</DialogTitle>
        <DialogDescription>
          Add items to your storage inventory.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-6 pt-2">
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Tip:</span> Common
          kitchen staples — water, salt, oil, pepper, and sugar — are always
          assumed to be in stock. Visit the{" "}
          <span className="font-medium text-foreground">🧂 Staples</span> tab
          to see the full list or add your own (e.g. cumin, turmeric).
        </p>

        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-medium">Start from a kitchen preset</p>
            <p className="text-xs text-muted-foreground">
              AI-generated presets designed for urban Indian kitchens. Select
              one to generate fridge and pantry items, then review the result.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2" aria-busy={isPending}>
            {PRESET_ORDER.map((presetId) => {
              const meta = PRESET_METADATA[presetId];
              const isActive = pendingAction === presetId;

              return (
                <button
                  key={presetId}
                  type="button"
                  disabled={isPending}
                  onClick={() => onSelectPreset(presetId)}
                  aria-busy={isActive && isPending}
                  className={`rounded-lg border bg-background px-4 py-3 text-left transition-[border-color,background-color,opacity] disabled:cursor-not-allowed disabled:opacity-100 ${
                    isActive
                      ? "border-foreground/20 bg-muted/80 shadow-sm"
                      : "hover:bg-muted"
                  } ${isPending && !isActive ? "opacity-60" : ""}`}
                >
                  <span className="block text-sm font-medium">
                    {meta.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {meta.description}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-foreground">
                    {isActive && isPending ? (
                      <>
                        <LoaderCircle
                          className="size-3 animate-spin"
                          aria-hidden
                        />
                        <span>Generating review...</span>
                      </>
                    ) : (
                      <span>Generate from preset</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="stock-freetext">
            Describe what you want to stock
          </Label>
          <Textarea
            id="stock-freetext"
            rows={6}
            disabled={isPending}
            placeholder={
              "I bought eggs, milk, yogurt, spinach, rice, olive oil, and a few spices for the pantry."
            }
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Natural language, loose lists, and mixed formatting are all fine. AI
            will extract the items and suggest storage details.
          </p>
        </div>

        {apiError ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {apiError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isTextPending
              ? "Parsing your note into inventory rows…"
              : trimmedInput
                ? "AI will read this note and lay out inventory rows for you to review."
                : "Paste a note or use a preset to get started."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!trimmedInput || isPending}
              aria-busy={isTextPending}
              onClick={onAnalyze}
            >
              {isTextPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  <span>Analyzing list...</span>
                </>
              ) : (
                "Review stock suggestions"
              )}
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
  onUpdateItem: <K extends keyof StockedItem>(
    id: string,
    field: K,
    value: StockedItem[K],
  ) => void;
  onBack: () => void;
  onCommit: () => void;
};

function PreviewStep({
  items,
  onUpdateItem,
  onBack,
  onCommit,
}: PreviewStepProps) {
  const flaggedCount = items.filter((i) => i.flagged).length;

  return (
    <>
      <DialogHeader className="px-0 pb-2 pt-0">
        <DialogTitle>Review AI-organized stock</DialogTitle>
        <DialogDescription>
          {flaggedCount > 0
            ? `${flaggedCount} item${flaggedCount !== 1 ? "s" : ""} flagged for review (highlighted in amber). Edit any field before adding to inventory.`
            : "Everything looks ready. Edit any field before adding to inventory."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 pt-2">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-16 w-16">
                  Emoji
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-32">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-16 max-w-20">
                  Qty
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-20 max-w-24">
                  Unit
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-24 max-w-32">
                  Category
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-20 max-w-28">
                  Storage
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-28 max-w-40">
                  Shelf
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-28 max-w-36">
                  Expires
                </th>
                <th className="px-3 py-2 min-w-6 w-6" />
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
          <Button
            type="button"
            disabled={items.length === 0}
            onClick={onCommit}
          >
            Add {items.length} item{items.length !== 1 ? "s" : ""} to inventory
          </Button>
        </div>
      </div>
    </>
  );
}

type PreviewRowProps = {
  item: StockedItem;
  onUpdate: <K extends keyof StockedItem>(
    id: string,
    field: K,
    value: StockedItem[K],
  ) => void;
};

function PreviewRow({ item, onUpdate }: PreviewRowProps) {
  const rowCls = item.flagged ? "border-t bg-amber-50" : "border-t";

  return (
    <tr className={rowCls}>
      <td className="px-2 py-1 min-w-16 w-16">
        <EmojiPicker
          value={item.emoji}
          onValueChange={(value) => onUpdate(item.id, "emoji", value)}
        />
      </td>
      <td className="px-2 py-1 min-w-32">
        <Input
          value={item.name}
          onChange={(e) => onUpdate(item.id, "name", e.target.value)}
          className="h-8 border-transparent shadow-none focus-visible:border-ring"
        />
      </td>
      <td className="px-2 py-1 min-w-16 max-w-20">
        <Input
          type="number"
          min={0}
          step="any"
          value={item.quantity}
          onChange={(e) =>
            onUpdate(item.id, "quantity", parseFloat(e.target.value) || 0)
          }
          className="w-full h-8 border-transparent shadow-none focus-visible:border-ring"
        />
      </td>
      <td className="px-2 py-1 min-w-20 max-w-24">
        <Select
          value={item.unit}
          onValueChange={(v) =>
            onUpdate(item.id, "unit", v as StockedItem["unit"])
          }
        >
          <SelectTrigger className="h-8 border-transparent shadow-none focus:ring-0 focus-visible:border-ring">
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
      </td>
      <td className="px-2 py-1 min-w-24 max-w-32">
        <Select
          value={item.category}
          onValueChange={(v) =>
            onUpdate(item.id, "category", v as StockedItem["category"])
          }
        >
          <SelectTrigger className="h-8 border-transparent shadow-none focus:ring-0 focus-visible:border-ring">
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
      </td>
      <td className="px-2 py-1 min-w-20 max-w-28">
        <Select
          value={item.storageType}
          onValueChange={(v) =>
            onUpdate(item.id, "storageType", v as StockedItem["storageType"])
          }
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
      <td className="px-2 py-1 min-w-28 max-w-40">
        <Input
          value={item.shelfName}
          onChange={(e) => onUpdate(item.id, "shelfName", e.target.value)}
          className="h-8 border-transparent shadow-none focus-visible:border-ring"
        />
      </td>
      <td className="px-2 py-1 min-w-28 max-w-36">
        <Input
          type="date"
          value={item.expiresAt ?? ""}
          onChange={(e) =>
            onUpdate(item.id, "expiresAt", e.target.value || undefined)
          }
          className="h-8 border-transparent shadow-none focus-visible:border-ring"
        />
      </td>
      <td className="px-2 py-1 text-center min-w-6 w-6">
        {item.flagged ? (
          <span title="Flagged for review" className="text-amber-500 text-sm">
            ⚠
          </span>
        ) : null}
      </td>
    </tr>
  );
}
