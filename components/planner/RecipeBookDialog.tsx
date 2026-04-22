"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MealValidationSummary } from "@/components/planner/MealValidationSummary";
import { RecipeIngredientList } from "@/components/planner/RecipeIngredientList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ExternalLink,
  Mic,
  MicOff,
  Square,
  Trash2,
  Upload,
  XIcon,
} from "lucide-react";
import type { InventoryItem } from "@/lib/inventory/types";
import type { PlannedMealType, Recipe, RecipeSource } from "@/lib/planner/types";
import { validateRecipeAgainstInventory } from "@/lib/planner/validation";
import { SUPPORTED_AUDIO_MIME_TYPES } from "@/lib/ai/transcription";

type RecipeBookDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipes: Recipe[];
  inventory: InventoryItem[];
  mode?: "browse" | "swap";
  swapMealType?: PlannedMealType;
  onSelectRecipe?: (recipeId: string) => void;
  onCreateCustomRecipe: (payload: {
    inventoryItemIds: string[];
    preferences: string;
    dishName: string;
  }) => Promise<string>;
  onCreateVoiceRecipe: (payload: {
    audioFile: File;
    preferences: string;
  }) => Promise<string>;
  onDeleteRecipe: (recipeId: string) => void;
};

type RecipeSourceFilter = RecipeSource | "all";
type RecipeMealTypeFilter = Recipe["mealType"] | "all";
type DialogView = "browse" | "detail" | "create" | "voice";
type RecipeBrowseState = {
  searchTerm: string;
  mealTypeFilter: RecipeMealTypeFilter;
  sourceFilter: RecipeSourceFilter;
};

const SOURCE_FILTERS: RecipeSourceFilter[] = [
  "all",
  "user-requested",
  "user-saved",
];
const MEAL_TYPE_FILTERS: RecipeMealTypeFilter[] = [
  "all",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

function formatSourceLabel(source: RecipeSource) {
  return source === "user-saved" ? "saved" : "generated";
}

function formatMealTypeLabel(mealType: Recipe["mealType"]) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

function matchesSearch(recipe: Recipe, searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  const haystack = [
    recipe.title,
    recipe.cuisine,
    recipe.mealType,
    ...recipe.tags,
    ...recipe.ingredients.map((ingredient) => ingredient.name),
    ...recipe.ingredients.map((ingredient) => ingredient.normalizedName),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function RecipeBookBrowse({
  recipes,
  inventory,
  mode,
  swapMealType,
  browseState,
  onBrowseStateChange,
  onViewRecipe,
  onSelectRecipe,
}: {
  recipes: Recipe[];
  inventory: InventoryItem[];
  mode: "browse" | "swap";
  swapMealType?: PlannedMealType;
  browseState: RecipeBrowseState;
  onBrowseStateChange: (nextState: RecipeBrowseState) => void;
  onViewRecipe: (recipeId: string) => void;
  onSelectRecipe?: (recipeId: string) => void;
}) {
  const { mealTypeFilter, searchTerm, sourceFilter } = browseState;
  const effectiveMealTypeFilter =
    mode === "swap" ? swapMealType ?? "all" : mealTypeFilter;

  const validationByRecipeId = useMemo(
    () =>
      new Map(
        recipes.map((recipe) => [
          recipe.id,
          validateRecipeAgainstInventory(recipe, inventory),
        ]),
      ),
    [inventory, recipes],
  );

  const filteredRecipes = useMemo(() => {
    const visibleRecipes = recipes.filter((recipe) => {
      const matchesMealType =
        effectiveMealTypeFilter === "all"
          ? true
          : recipe.mealType === effectiveMealTypeFilter;
      const matchesSource =
        sourceFilter === "all" ? true : recipe.source === sourceFilter;
      return matchesMealType && matchesSource && matchesSearch(recipe, searchTerm);
    });

    return [...visibleRecipes].sort((left, right) => {
      const leftValidation = validationByRecipeId.get(left.id);
      const rightValidation = validationByRecipeId.get(right.id);
      const leftCookable = leftValidation?.canCook ? 0 : 1;
      const rightCookable = rightValidation?.canCook ? 0 : 1;
      const leftSource = left.source === "user-saved" ? 0 : 1;
      const rightSource = right.source === "user-saved" ? 0 : 1;

      return (
        leftCookable - rightCookable ||
        leftSource - rightSource ||
        left.mealType.localeCompare(right.mealType, "en-US") ||
        left.title.localeCompare(right.title, "en-US")
      );
    });
  }, [effectiveMealTypeFilter, recipes, searchTerm, sourceFilter, validationByRecipeId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-3 border-b px-6 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="recipe-book-search">Search recipes</Label>
          <Input
            id="recipe-book-search"
            placeholder="Search by title, tag, cuisine, or ingredient"
            value={searchTerm}
            onChange={(event) =>
              onBrowseStateChange({
                ...browseState,
                searchTerm: event.target.value,
              })
            }
          />
        </div>
        <div className="grid gap-2">
          {mode === "browse" ? (
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPE_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={mealTypeFilter === filter ? "default" : "outline"}
                  onClick={() =>
                    onBrowseStateChange({
                      ...browseState,
                      mealTypeFilter: filter,
                    })
                  }
                >
                  {filter === "all" ? "All meals" : formatMealTypeLabel(filter)}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Swapping {formatMealTypeLabel(swapMealType ?? "dinner")}</Badge>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {SOURCE_FILTERS.map((filter) => (
              <Button
                key={filter}
                type="button"
                size="sm"
                variant={sourceFilter === filter ? "default" : "outline"}
                onClick={() =>
                  onBrowseStateChange({
                    ...browseState,
                    sourceFilter: filter,
                  })
                }
              >
                {filter === "all" ? "All sources" : formatSourceLabel(filter)}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-6 py-4">
        <div className="grid gap-3 pb-4">
          {filteredRecipes.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No recipes match the current filters.
            </div>
          ) : null}
          {filteredRecipes.map((recipe) => {
            const validation = validationByRecipeId.get(recipe.id);
            const availabilityLabel = validation?.canCook
              ? "Can cook from current inventory"
              : validation && (validation.lowItems.length > 0 || validation.missingItems.length > 0)
                ? `${validation.lowItems.length + validation.missingItems.length} ingredient gaps`
                : "Needs inventory review";
            const availabilityVariant = validation?.canCook ? "default" : "outline";

            return (
              <div
                key={recipe.id}
                className={`rounded-2xl border bg-background p-4 shadow-sm transition-colors hover:border-border/80 ${mode === "browse" ? "cursor-pointer" : ""}`}
                role={mode === "browse" ? "button" : undefined}
                tabIndex={mode === "browse" ? 0 : undefined}
                onClick={mode === "browse" ? () => onViewRecipe(recipe.id) : undefined}
                onKeyDown={
                  mode === "browse"
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onViewRecipe(recipe.id);
                        }
                      }
                    : undefined
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {mode === "browse" ? (
                    <div className="min-w-0 flex-1 space-y-2 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{recipe.title}</h3>
                        <Badge variant="outline">{formatMealTypeLabel(recipe.mealType)}</Badge>
                        <Badge variant="secondary">{formatSourceLabel(recipe.source)}</Badge>
                        <Badge variant={availabilityVariant}>{availabilityLabel}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {recipe.cuisine ? `${recipe.cuisine} cuisine` : "Kitchen staple"}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{recipe.title}</h3>
                        <Badge variant="outline">{formatMealTypeLabel(recipe.mealType)}</Badge>
                        <Badge variant="secondary">{formatSourceLabel(recipe.source)}</Badge>
                        <Badge variant={availabilityVariant}>{availabilityLabel}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {recipe.cuisine ? `${recipe.cuisine} cuisine` : "Kitchen staple"}
                      </div>
                    </div>
                  )}
                  {mode === "swap" && onSelectRecipe ? (
                    <Button type="button" onClick={() => onSelectRecipe(recipe.id)}>
                      Use this recipe
                    </Button>
                  ) : null}
                </div>
                {recipe.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recipe.tags.map((tag) => (
                      <Badge key={`${recipe.id}-${tag}`} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <div>
                    Ingredients: {recipe.ingredients.map((ingredient) => ingredient.name).join(", ")}
                  </div>
                  {validation && !validation.canCook && validation.missingItems.length > 0 ? (
                    <div>Missing: {validation.missingItems.join(", ")}</div>
                  ) : null}
                  {validation && validation.lowItems.length > 0 ? (
                    <div>Low stock: {validation.lowItems.join(", ")}</div>
                  ) : null}
                </div>
                {recipe.referenceUrl ? (
                  <div className="mt-3">
                    <a
                      href={recipe.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Open recipe source
                    </a>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function RecipeBookCreate({
  inventory,
  onCreateCustomRecipe,
  onRecipeCreated,
}: {
  inventory: InventoryItem[];
  onCreateCustomRecipe: (payload: {
    inventoryItemIds: string[];
    preferences: string;
    dishName: string;
  }) => Promise<string>;
  onRecipeCreated: (recipeId: string) => void;
}) {
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedInventoryItemIds, setSelectedInventoryItemIds] = useState<string[]>([]);
  const [dishName, setDishName] = useState("");
  const [preferences, setPreferences] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredInventory = useMemo(() => {
    const normalizedSearch = inventorySearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return inventory;
    }

    return inventory.filter((item) => {
      const haystack = `${item.name} ${item.normalizedName} ${item.category}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [inventory, inventorySearch]);

  const selectedCount = selectedInventoryItemIds.length;

  async function handleSubmit() {
    if (selectedInventoryItemIds.length === 0) {
      setSubmitError("Select at least one inventory item for the recipe.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const recipeId = await onCreateCustomRecipe({
        inventoryItemIds: selectedInventoryItemIds,
        preferences,
        dishName,
      });
      setDishName("");
      setPreferences("");
      setSelectedInventoryItemIds([]);
      setInventorySearch("");
      onRecipeCreated(recipeId);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to generate a recipe right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleInventoryItem(itemId: string) {
    setSelectedInventoryItemIds((current) =>
      current.includes(itemId)
        ? current.filter((candidateId) => candidateId !== itemId)
        : [...current, itemId],
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="custom-recipe-name">Dish name</Label>
            <Input
              id="custom-recipe-name"
              placeholder="Optional, for example Spinach paneer toast"
              value={dishName}
              onChange={(event) => setDishName(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="custom-recipe-preferences">Preferences</Label>
            <Textarea
              id="custom-recipe-preferences"
              rows={4}
              placeholder="Optional notes such as high protein, quick dinner, or avoid peanuts"
              value={preferences}
              onChange={(event) => setPreferences(event.target.value)}
            />
          </div>
          {submitError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              Selected inventory items: {selectedCount}
            </div>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting || selectedCount === 0}>
              {isSubmitting ? "Generating recipe..." : "Save recipe to book"}
            </Button>
          </div>
        </div>
      </div>
      <Separator orientation="vertical" className="hidden xl:block" />
      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="custom-recipe-inventory-search">Inventory subset</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedInventoryItemIds(filteredInventory.map((item) => item.id))}
                disabled={filteredInventory.length === 0}
              >
                Select visible
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedInventoryItemIds([])}
                disabled={selectedInventoryItemIds.length === 0}
              >
                Clear
              </Button>
            </div>
          </div>
          <Input
            id="custom-recipe-inventory-search"
            placeholder="Filter inventory items"
            value={inventorySearch}
            onChange={(event) => setInventorySearch(event.target.value)}
          />
        </div>
        <ScrollArea className="mt-4 min-h-0 flex-1 pr-2">
          <div className="grid gap-2 pb-4">
            {filteredInventory.map((item) => {
              const isSelected = selectedInventoryItemIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                    isSelected ? "border-primary/40 bg-primary/5" : "bg-background hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleInventoryItem(item.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{item.emoji ? `${item.emoji} ` : ""}{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} {item.unit} · {item.category}
                      {item.expiresAt ? ` · expires ${item.expiresAt}` : ""}
                    </div>
                  </div>
                </label>
              );
            })}
            {filteredInventory.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                No inventory items match the current filter.
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

const MAX_AUDIO_SIZE_MB = 8;
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const ACCEPTED_AUDIO_TYPES = "audio/mp3,audio/mpeg,audio/wav,audio/webm,audio/ogg,audio/flac,audio/aac,audio/mp4,audio/x-m4a";

type VoiceCaptureMode = "upload" | "record";
type RecordingState = "idle" | "recording" | "stopped";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RecipeBookVoiceCreate({
  onCreateVoiceRecipe,
  onRecipeCreated,
}: {
  onCreateVoiceRecipe: (payload: { audioFile: File; preferences: string }) => Promise<string>;
  onRecipeCreated: (recipeId: string) => void;
}) {
  const [captureMode, setCaptureMode] = useState<VoiceCaptureMode>("upload");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [preferences, setPreferences] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop and clean up the media stream when the component unmounts or mode changes
  const stopStream = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      const tracks = (mediaRecorderRef.current.stream as MediaStream | undefined)?.getTracks();
      tracks?.forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  function switchCaptureMode(mode: VoiceCaptureMode) {
    stopStream();
    setAudioFile(null);
    setRecordingState("idle");
    setRecordingSeconds(0);
    setMicError(null);
    setSubmitError(null);
    audioChunksRef.current = [];
    setCaptureMode(mode);
  }

  async function handleStartRecording() {
    setMicError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "voice-note.webm", { type: "audio/webm" });
        setAudioFile(file);
        setRecordingState("stopped");
      };

      recorder.start(250);
      setRecordingState("recording");
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      setMicError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone access was denied. Allow microphone access in your browser settings."
          : "Could not access the microphone. Please check your device settings.",
      );
    }
  }

  function handleStopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    const tracks = (mediaRecorderRef.current?.stream as MediaStream | undefined)?.getTracks();
    tracks?.forEach((t) => t.stop());
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSubmitError(null);
    if (!file) {
      setAudioFile(null);
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      setSubmitError(`Audio file must be under ${MAX_AUDIO_SIZE_MB} MB.`);
      setAudioFile(null);
      event.target.value = "";
      return;
    }
    const baseMime = file.type.split(";")[0].trim();
    if (!SUPPORTED_AUDIO_MIME_TYPES.has(baseMime)) {
      setSubmitError("Unsupported audio format. Use mp3, wav, webm, ogg, flac, aac, or mp4.");
      setAudioFile(null);
      event.target.value = "";
      return;
    }
    setAudioFile(file);
  }

  async function handleSubmit() {
    if (!audioFile) {
      setSubmitError(captureMode === "upload" ? "Please select an audio file." : "Please record a voice note first.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const recipeId = await onCreateVoiceRecipe({ audioFile, preferences });
      setAudioFile(null);
      setPreferences("");
      setRecordingState("idle");
      setRecordingSeconds(0);
      audioChunksRef.current = [];
      onRecipeCreated(recipeId);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to generate a recipe right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasAudio = audioFile !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
      <div className="grid gap-4">
        {/* Capture mode tabs */}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={captureMode === "upload" ? "default" : "outline"}
            onClick={() => switchCaptureMode("upload")}
            disabled={isSubmitting}
          >
            <Upload className="size-4" aria-hidden />
            Upload file
          </Button>
          <Button
            type="button"
            size="sm"
            variant={captureMode === "record" ? "default" : "outline"}
            onClick={() => switchCaptureMode("record")}
            disabled={isSubmitting}
          >
            <Mic className="size-4" aria-hidden />
            Record audio
          </Button>
        </div>

        {/* Upload mode */}
        {captureMode === "upload" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="voice-recipe-audio-upload">Audio file</Label>
            <Input
              id="voice-recipe-audio-upload"
              type="file"
              accept={ACCEPTED_AUDIO_TYPES}
              disabled={isSubmitting}
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Accepted formats: mp3, wav, webm, ogg, flac, aac, mp4 · Max {MAX_AUDIO_SIZE_MB} MB
            </p>
          </div>
        ) : null}

        {/* Record mode */}
        {captureMode === "record" ? (
          <div className="grid gap-3">
            {micError ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <MicOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                {micError}
              </div>
            ) : null}
            {recordingState === "idle" ? (
              <Button
                type="button"
                variant="outline"
                className="h-16 w-full gap-3 rounded-2xl border-2 border-dashed text-base"
                onClick={() => void handleStartRecording()}
                disabled={isSubmitting}
              >
                <Mic className="size-5" aria-hidden />
                Tap to start recording
              </Button>
            ) : recordingState === "recording" ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 px-4 py-5">
                <div className="flex items-center gap-2 text-primary">
                  <span className="size-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
                  <span className="text-sm font-semibold">Recording</span>
                  <span className="font-mono text-sm">{formatDuration(recordingSeconds)}</span>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={handleStopRecording}
                >
                  <Square className="size-4" aria-hidden />
                  Stop recording
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Audio ready indicator */}
        {hasAudio ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
            <div className="min-w-0 text-sm">
              <span className="font-medium text-foreground">{audioFile.name}</span>
              <span className="ml-2 text-muted-foreground">{formatBytes(audioFile.size)}</span>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Remove audio"
              onClick={() => {
                setAudioFile(null);
                if (captureMode === "record") {
                  setRecordingState("idle");
                  setRecordingSeconds(0);
                  audioChunksRef.current = [];
                }
                setSubmitError(null);
              }}
              disabled={isSubmitting}
            >
              <XIcon className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        {/* Preferences */}
        <div className="grid gap-1.5">
          <Label htmlFor="voice-recipe-preferences">Additional preferences</Label>
          <Textarea
            id="voice-recipe-preferences"
            rows={3}
            placeholder="Optional — e.g. high protein, quick weeknight dinner, avoid nuts"
            value={preferences}
            disabled={isSubmitting}
            onChange={(event) => setPreferences(event.target.value)}
          />
        </div>

        {submitError ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !hasAudio}
          >
            {isSubmitting ? "Generating recipe…" : "Generate recipe"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecipeBookDetail({
  recipe,
  inventory,
  onBack,
  deleteConfirmOpen,
  onDeleteConfirmOpenChange,
  onDeleteRecipe,
}: {
  recipe: Recipe;
  inventory: InventoryItem[];
  onBack: () => void;
  deleteConfirmOpen: boolean;
  onDeleteConfirmOpenChange: (open: boolean) => void;
  onDeleteRecipe: (recipeId: string) => void;
}) {
  const validation = useMemo(
    () => validateRecipeAgainstInventory(recipe, inventory),
    [inventory, recipe],
  );
  const detailStats = [
    { label: "Ingredients", value: String(recipe.ingredients.length) },
    { label: "Steps", value: String(recipe.instructions?.length ?? 0) },
    { label: "Tags", value: String(recipe.tags.length) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-4">
            <Button type="button" variant="ghost" size="sm" className="-ml-3 w-fit" onClick={onBack}>
              <ArrowLeft className="size-4" aria-hidden />
              Back to recipes
            </Button>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{formatMealTypeLabel(recipe.mealType)}</Badge>
                <Badge variant="secondary">{formatSourceLabel(recipe.source)}</Badge>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                  {recipe.title}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
                  {recipe.cuisine ? `${recipe.cuisine} cuisine` : "Kitchen staple"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:max-w-sm">
                {detailStats.map((stat) => (
                  <div
                    key={`${recipe.id}-${stat.label}`}
                    className="rounded-xl border bg-background/80 px-3 py-2"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {stat.label}
                    </div>
                    <div className="mt-1 text-base font-semibold text-foreground">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {recipe.source === "user-saved" ? (
            <Popover
              open={deleteConfirmOpen}
              onOpenChange={onDeleteConfirmOpenChange}
            >
              <PopoverTrigger
                type="button"
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
              >
                <Trash2 className="size-4" aria-hidden />
                Delete recipe
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-80 p-4">
                <PopoverHeader>
                  <PopoverTitle>Delete this recipe?</PopoverTitle>
                  <PopoverDescription>
                    This removes the saved recipe from your recipe book. You
                    can regenerate it later from your inventory.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDeleteConfirmOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      onDeleteConfirmOpenChange(false);
                      onDeleteRecipe(recipe.id);
                    }}
                  >
                    Delete recipe
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid gap-4 pb-5 sm:gap-5">
          <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Cookability
              </p>
              <h4 className="text-base font-semibold text-foreground">Inventory check</h4>
            </div>
            <div className="mt-3">
              <MealValidationSummary validation={validation} />
            </div>
          </section>

          {recipe.tags.length > 0 ? (
            <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Tags
                </p>
                <h4 className="text-base font-semibold text-foreground">Recipe notes</h4>
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {recipe.tags.map((tag) => (
                  <Badge key={`${recipe.id}-${tag}`} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Ingredients
              </p>
              <h4 className="text-base font-semibold text-foreground">What you need</h4>
            </div>
            <div className="mt-3">
              <RecipeIngredientList ingredients={recipe.ingredients} matches={validation.matches} />
            </div>
          </section>

          {recipe.instructions && recipe.instructions.length > 0 ? (
            <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Method
                </p>
                <h4 className="text-base font-semibold text-foreground">Cooking steps</h4>
              </div>
              <ol className="mt-3 grid gap-2.5 text-sm text-muted-foreground sm:gap-3">
                {recipe.instructions.map((instruction, index) => (
                  <li
                    key={`${recipe.id}-step-${index}`}
                    className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border bg-muted/20 px-3 py-3 sm:px-4"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 leading-6">{instruction}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {recipe.referenceUrl ? (
            <section className="rounded-2xl border bg-background/80 p-4 sm:p-5">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Source
                </p>
                <h4 className="text-base font-semibold text-foreground">Original recipe</h4>
              </div>
              <div className="mt-3">
                <a
                  href={recipe.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Open recipe source
                </a>
              </div>
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

export function RecipeBookDialog({
  open,
  onOpenChange,
  recipes,
  inventory,
  mode = "browse",
  swapMealType,
  onSelectRecipe,
  onCreateCustomRecipe,
  onCreateVoiceRecipe,
  onDeleteRecipe,
}: RecipeBookDialogProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>();
  const [browseState, setBrowseState] = useState<RecipeBrowseState>({
    searchTerm: "",
    mealTypeFilter: "all",
    sourceFilter: "all",
  });
  const [view, setView] = useState<DialogView>("browse");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const showCreateView = mode === "browse";
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId),
    [recipes, selectedRecipeId],
  );

  function handleViewRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId);
    setView("detail");
    setDeleteConfirmOpen(false);
  }

  function handleRecipeCreated(recipeId: string) {
    setSelectedRecipeId(recipeId);
    setView("detail");
    setDeleteConfirmOpen(false);
  }

  function handleBackToBrowse() {
    setView("browse");
    setDeleteConfirmOpen(false);
  }

  function handleDeleteRecipe(recipeId: string) {
    if (!selectedRecipe || selectedRecipe.id !== recipeId) {
      return;
    }

    setSelectedRecipeId(undefined);
    setView("browse");
    setDeleteConfirmOpen(false);
    onDeleteRecipe(recipeId);
  }

  function handleDrawerOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedRecipeId(undefined);
      setView("browse");
      setDeleteConfirmOpen(false);
    }

    onOpenChange(nextOpen);
  }

  const headerTitle =
    mode === "swap"
      ? "Swap meal from recipe book"
      : view === "detail"
        ? "Recipe details"
        : "Recipe book";
  const headerDescription =
    mode === "swap"
      ? `Choose a ${swapMealType ?? "saved"} recipe directly from your recipe book.`
      : view === "detail"
        ? "Review cookability, ingredients, and instructions without leaving the drawer."
        : view === "voice"
          ? "Record or upload a voice note and generate a recipe from your spoken idea."
          : "Browse saved recipes, review what you can cook from current inventory, and create custom recipes from selected items.";

  return (
    <Drawer open={open} onOpenChange={handleDrawerOpenChange} direction="left">
      <DrawerContent className="h-svh w-[min(94vw,56rem)] max-w-[min(94vw,56rem)] overflow-hidden p-0 data-[vaul-drawer-direction=left]:w-[min(94vw,56rem)] data-[vaul-drawer-direction=left]:sm:max-w-[min(94vw,56rem)]">
        <DrawerHeader className="border-b px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DrawerTitle>{headerTitle}</DrawerTitle>
              <DrawerDescription>{headerDescription}</DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Close recipe book">
                <XIcon className="size-4" aria-hidden />
              </Button>
            </DrawerClose>
          </div>
          {showCreateView && view !== "detail" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={view === "browse" ? "default" : "outline"}
                onClick={() => setView("browse")}
              >
                Browse recipes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "create" ? "default" : "outline"}
                onClick={() => setView("create")}
              >
                Create recipe
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "voice" ? "default" : "outline"}
                onClick={() => setView("voice")}
              >
                <Mic className="size-3.5" aria-hidden />
                Voice note
              </Button>
            </div>
          ) : null}
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          {view === "detail" && selectedRecipe ? (
            <RecipeBookDetail
              recipe={selectedRecipe}
              inventory={inventory}
              onBack={handleBackToBrowse}
              deleteConfirmOpen={deleteConfirmOpen}
              onDeleteConfirmOpenChange={setDeleteConfirmOpen}
              onDeleteRecipe={handleDeleteRecipe}
            />
          ) : view === "create" && showCreateView ? (
            <RecipeBookCreate
              inventory={inventory}
              onCreateCustomRecipe={onCreateCustomRecipe}
              onRecipeCreated={handleRecipeCreated}
            />
          ) : view === "voice" && showCreateView ? (
            <RecipeBookVoiceCreate
              onCreateVoiceRecipe={onCreateVoiceRecipe}
              onRecipeCreated={handleRecipeCreated}
            />
          ) : (
            <RecipeBookBrowse
              recipes={recipes}
              inventory={inventory}
              mode={mode}
              swapMealType={swapMealType}
              browseState={browseState}
              onBrowseStateChange={setBrowseState}
              onViewRecipe={handleViewRecipe}
              onSelectRecipe={onSelectRecipe}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
