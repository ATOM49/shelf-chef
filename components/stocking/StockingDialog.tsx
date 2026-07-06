"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2, XIcon } from "lucide-react";
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
  StockImageRequest,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
type PendingAction = "text" | "image" | PresetId;
type PresetMode = "instant" | "ai";

const PRESET_EMOJI: Record<PresetId, string> = {
  scarce: "🌱",
  "fridge-heavy": "🧊",
  "pantry-heavy": "🗄️",
  "well-stocked": "🍱",
};

export type SharedStockImage = {
  dataUrl: string;
  fileName?: string;
};

type SelectedStockImage = {
  base64: string;
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

type StockingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (items: StockingItemDraft[]) => void;
  customStapleNames?: readonly string[];
  sharedImage?: SharedStockImage | null;
  onSharedImageConsumed?: () => void;
  /** Shown as a lightweight escape hatch for brand-new users with an empty inventory. */
  isNewUser?: boolean;
  /** Called when a new user chooses to skip stocking and go straight to planning. */
  onSkipToPlanner?: () => void;
};

const MAX_STOCK_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_STOCK_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

async function fileToSelectedStockImage(file: File): Promise<SelectedStockImage> {
  if (file.size > MAX_STOCK_IMAGE_BYTES) {
    throw new Error("Images must be smaller than 8 MB.");
  }

  const mimeType = normalizeImageMimeType(file);
  if (!ACCEPTED_STOCK_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Choose a JPEG, PNG, WebP, HEIC, or HEIF image.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  return selectedStockImageFromDataUrl(dataUrl, file.name || "Selected image");
}

function selectedStockImageFromDataUrl(
  dataUrl: string,
  fileName: string,
): SelectedStockImage {
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Shared image data could not be read.");
  }

  const mimeType = match[1].toLowerCase();
  if (!ACCEPTED_STOCK_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Choose a JPEG, PNG, WebP, HEIC, or HEIF image.");
  }

  return {
    base64: match[2],
    dataUrl,
    fileName,
    mimeType,
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Image could not be read."));
    });
    reader.addEventListener("error", () => {
      reject(new Error("Image could not be read."));
    });
    reader.readAsDataURL(file);
  });
}

function normalizeImageMimeType(file: File) {
  if (file.type) {
    return file.type.toLowerCase();
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StockingDialog({
  open,
  onOpenChange,
  onCommit,
  customStapleNames = [],
  sharedImage = null,
  onSharedImageConsumed,
  isNewUser = false,
  onSkipToPlanner,
}: StockingDialogProps) {
  const [step, setStep] = useState<Step>("input");
  const [freeText, setFreeText] = useState("");
  const [selectedImage, setSelectedImage] = useState<SelectedStockImage | null>(
    null,
  );
  const [stockedItems, setStockedItems] = useState<StockedItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [isPending, setIsPending] = useState(false);
  const [presetMode, setPresetMode] = useState<PresetMode>("instant");
  const consumedSharedImageRef = useRef<string | null>(null);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("input");
      setFreeText("");
      setSelectedImage(null);
      setStockedItems([]);
      setApiError(null);
      setPendingAction(null);
      setPresetMode("instant");
    }, 300);
  };

  const handleSkipToPlanner = () => {
    onSkipToPlanner?.();
    handleClose();
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

  const requestJsonReview = (
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

  const requestImageReview = useCallback(
    (
      image: SelectedStockImage,
      nextPendingAction: PendingAction = "image",
    ) => {
      const stapleNames = getAllStapleNames(customStapleNames);
      const stapleSet = new Set(stapleNames.map(normalizeIngredientName));
      const request: StockImageRequest = {
        imageBase64: image.base64,
        imageMimeType: image.mimeType,
        stapleNames,
      };

      setApiError(null);
      setPendingAction(nextPendingAction);
      setIsPending(true);
      void (async () => {
        try {
          const res = await fetch("/api/stock/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          });
          if (!res.ok) {
            const err = (await res.json()) as { error?: string };
            throw new Error(err.error ?? `HTTP ${res.status}`);
          }
          const rawData = (await res.json()) as StockApiResponse;
          const data = parseStockApiResponseForReview(rawData);
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
    },
    [customStapleNames],
  );

  const handleAnalyze = () => {
    const input = freeText.trim();
    if (!input) {
      return;
    }

    requestJsonReview("/api/stock", { input }, "text");
  };

  const handlePresetSelect = (presetId: PresetId) => {
    requestJsonReview(
      "/api/stock/preset",
      { presetId, useSeed: presetMode === "instant" },
      presetId,
    );
  };

  const handleImageFileChange = (file: File | null) => {
    if (!file) {
      return;
    }

    void (async () => {
      try {
        const image = await fileToSelectedStockImage(file);
        setSelectedImage(image);
        setApiError(null);
      } catch (err) {
        setSelectedImage(null);
        setApiError(err instanceof Error ? err.message : "Unknown error");
      }
    })();
  };

  const handleImageAnalyze = () => {
    if (!selectedImage) {
      return;
    }

    requestImageReview(selectedImage);
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

  const pendingState = getStockPendingState(pendingAction, presetMode);
  const trimmedInput = freeText.trim();
  const isTextPending = isPending && pendingAction === "text";
  const isImagePending = isPending && pendingAction === "image";

  useEffect(() => {
    if (!open || !sharedImage || consumedSharedImageRef.current === sharedImage.dataUrl) {
      return;
    }

    try {
      const image = selectedStockImageFromDataUrl(
        sharedImage.dataUrl,
        sharedImage.fileName ?? "Shared image",
      );
      consumedSharedImageRef.current = sharedImage.dataUrl;
      queueMicrotask(() => {
        setSelectedImage(image);
        requestImageReview(image);
        onSharedImageConsumed?.();
      });
    } catch (err) {
      queueMicrotask(() => {
        setApiError(err instanceof Error ? err.message : "Unknown error");
        onSharedImageConsumed?.();
      });
    }
  }, [onSharedImageConsumed, open, requestImageReview, sharedImage]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        aria-busy={isPending}
        showCloseButton={false}
        className="w-full p-0"
      >
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
              ? "flex-1 overflow-y-auto p-6 pointer-events-none select-none opacity-30"
              : "flex-1 overflow-y-auto p-6"
          }
        >
          {step === "input" ? (
            <InputStep
              freeText={freeText}
              onFreeTextChange={setFreeText}
              isPending={isPending}
              pendingAction={pendingAction}
              apiError={apiError}
              selectedImage={selectedImage}
              onImageFileChange={handleImageFileChange}
              onClearImage={() => setSelectedImage(null)}
              onSelectPreset={handlePresetSelect}
              presetMode={presetMode}
              onPresetModeChange={setPresetMode}
              isNewUser={isNewUser}
              onSkipToPlanner={onSkipToPlanner ? handleSkipToPlanner : undefined}
            />
          ) : (
            <PreviewStep
              items={stockedItems}
              onUpdateItem={updateStockedItem}
            />
          )}
        </div>

        <DialogFooter
          className={isPending ? "pointer-events-none select-none opacity-30" : undefined}
        >
          {step === "input" ? (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedImage || isPending}
                aria-busy={isImagePending}
                onClick={handleImageAnalyze}
              >
                {isImagePending ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    <span>Analyzing image...</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-4" aria-hidden />
                    <span>Review image</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                disabled={!trimmedInput || isPending}
                aria-busy={isTextPending}
                onClick={handleAnalyze}
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
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("input")}>
                ← Back
              </Button>
              <Button
                type="button"
                disabled={stockedItems.length === 0}
                onClick={handleCommit}
              >
                Add {stockedItems.length} item{stockedItems.length !== 1 ? "s" : ""} to inventory
              </Button>
            </>
          )}
        </DialogFooter>

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
      </DialogContent>
    </Dialog>
  );
}

function getStockPendingState(
  pendingAction: PendingAction | null,
  presetMode: PresetMode,
) {
  if (pendingAction === "text") {
    return {
      title: "Reading your stock note",
      description:
        "Pulling out items from your note and suggesting where they belong.",
      statusLabel: "Analyzing stock note",
    };
  }

  if (pendingAction === "image") {
    return {
      title: "Reading your stock image",
      description:
        "Scanning the image for groceries and suggesting where each item belongs.",
      statusLabel: "Analyzing stock image",
    };
  }

  if (pendingAction) {
    const presetLabel = PRESET_METADATA[pendingAction].label;

    if (presetMode === "ai") {
      return {
        title: `Generating the ${presetLabel} preset with AI`,
        description:
          "Asking the AI to build out a fresh kitchen full of items for this preset — almost ready to review!",
        statusLabel: "Generating stock preset",
      };
    }

    return {
      title: `Loading the ${presetLabel} preset`,
      description: "Pulling in a ready-made set of items for this preset — almost ready to review!",
      statusLabel: "Loading stock preset",
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
  selectedImage: SelectedStockImage | null;
  onImageFileChange: (file: File | null) => void;
  onClearImage: () => void;
  onSelectPreset: (presetId: PresetId) => void;
  presetMode: PresetMode;
  onPresetModeChange: (mode: PresetMode) => void;
  isNewUser: boolean;
  onSkipToPlanner?: () => void;
};

function InputStep({
  freeText,
  onFreeTextChange,
  isPending,
  pendingAction,
  apiError,
  selectedImage,
  onImageFileChange,
  onClearImage,
  onSelectPreset,
  presetMode,
  onPresetModeChange,
  isNewUser,
  onSkipToPlanner,
}: InputStepProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <DialogHeader className="px-0 pb-1 pt-0">
        <DialogTitle>Stock up</DialogTitle>
        <DialogDescription className="sr-only">
          Add items to your storage inventory.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 pt-2">
        {/* Describe / photo — one focused input surface */}
        <div className="grid gap-2">
          <div className="relative">
            <Textarea
              id="stock-freetext"
              rows={5}
              disabled={isPending}
              placeholder="Type or paste anything — “eggs, milk, spinach, rice, olive oil, a few spices…”"
              value={freeText}
              onChange={(e) => onFreeTextChange(e.target.value)}
              className="resize-none pb-11 text-sm"
            />
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => imageInputRef.current?.click()}
                className="h-7 gap-1.5 px-2 text-muted-foreground"
              >
                <ImagePlus className="size-4" aria-hidden />
                <span>Add a photo</span>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Lists, receipts &amp; photos all work
              </span>
            </div>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            disabled={isPending}
            onChange={(event) => {
              onImageFileChange(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          {selectedImage ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
              <div
                aria-hidden
                className="size-11 shrink-0 rounded-md border bg-cover bg-center"
                style={{ backgroundImage: `url(${selectedImage.dataUrl})` }}
              />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {selectedImage.fileName}
              </p>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Remove selected stock image"
                disabled={isPending}
                onClick={onClearImage}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>

        {/* Presets */}
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              or start from a preset
            </span>
            <div className="flex shrink-0 gap-0.5 rounded-lg border bg-muted/40 p-0.5">
              <button
                type="button"
                disabled={isPending}
                onClick={() => onPresetModeChange("instant")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                  presetMode === "instant"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Instant
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onPresetModeChange("ai")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                  presetMode === "ai"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ✨ AI
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2" aria-busy={isPending}>
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
                  title={meta.description}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,opacity] disabled:cursor-not-allowed disabled:opacity-100 ${
                    isActive
                      ? "border-foreground/20 bg-muted shadow-sm"
                      : "bg-background hover:bg-muted"
                  } ${isPending && !isActive ? "opacity-60" : ""}`}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {isActive && isPending ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    ) : (
                      PRESET_EMOJI[presetId]
                    )}
                  </span>
                  <span className="text-sm font-medium">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {apiError ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {apiError}
          </p>
        ) : null}

        {isNewUser && onSkipToPlanner ? (
          <div className="flex justify-center pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={onSkipToPlanner}
              className="text-muted-foreground"
            >
              Skip for now — start planning →
            </Button>
          </div>
        ) : null}
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
};

function PreviewStep({
  items,
  onUpdateItem,
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
          <span
            title="Flagged for review"
            className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
          >
            Review
          </span>
        ) : null}
      </td>
    </tr>
  );
}
