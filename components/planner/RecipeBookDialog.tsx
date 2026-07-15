"use client";

import { useMemo, useState } from "react";
import { ItemCard } from "@/components/entities/ItemCard";
import { formatItemQuantity } from "@/components/entities/item-status";
import {
  RecipeCard,
  formatMealTypeLabel,
} from "@/components/entities/RecipeCard";
import { RecipeDetailPanel } from "@/components/planner/RecipeDetailPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { XIcon } from "lucide-react";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Recipe } from "@/lib/planner/types";
import { validateRecipeAgainstInventory } from "@/lib/planner/validation";

export type CreateRecipePayload =
  | { mode: "dish"; dishName: string; preferences: string }
  | { mode: "ingredients"; inventoryItemIds: string[]; preferences: string; dishName?: string };

type RecipeBookDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipes: Recipe[];
  inventory: InventoryItem[];
  mode?: "browse" | "swap";
  onSelectRecipe?: (recipeId: string) => void;
  onGenerateAndSwap?: (payload: CreateRecipePayload) => Promise<void>;
  onCreateCustomRecipe: (payload: CreateRecipePayload) => Promise<string>;
  onDeleteRecipe: (recipeId: string) => void;
};

type DialogView = "browse" | "detail" | "create";
type RecipeBrowseState = {
  searchTerm: string;
  selectedTags: string[];
};

const MEAL_TYPE_TAG_ORDER = new Map<Recipe["mealType"], number>([
  ["breakfast", 0],
  ["lunch", 1],
  ["dinner", 2],
  ["snack", 3],
]);

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

function getRecipeTagLabels(recipe: Recipe) {
  const labels = [
    formatMealTypeLabel(recipe.mealType),
    ...recipe.tags,
  ].filter((tag) => tag.trim().length > 0);
  const seen = new Set<string>();

  return labels.filter((tag) => {
    const normalizedTag = normalizeTag(tag);
    if (seen.has(normalizedTag)) {
      return false;
    }

    seen.add(normalizedTag);
    return true;
  });
}

function getRecipeTagSet(recipe: Recipe) {
  return new Set(getRecipeTagLabels(recipe).map(normalizeTag));
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
  browseState,
  onBrowseStateChange,
  onViewRecipe,
  onSelectRecipe,
}: {
  recipes: Recipe[];
  inventory: InventoryItem[];
  mode: "browse" | "swap";
  browseState: RecipeBrowseState;
  onBrowseStateChange: (nextState: RecipeBrowseState) => void;
  onViewRecipe: (recipeId: string) => void;
  onSelectRecipe?: (recipeId: string) => void;
}) {
  const { searchTerm, selectedTags } = browseState;

  const normalizedSelectedTags = useMemo(
    () => selectedTags.map(normalizeTag),
    [selectedTags],
  );

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

  const tagFilters = useMemo(() => {
    const tagByNormalized = new Map<string, string>();

    for (const recipe of recipes) {
      for (const tag of getRecipeTagLabels(recipe)) {
        const normalizedTag = normalizeTag(tag);
        if (!tagByNormalized.has(normalizedTag)) {
          tagByNormalized.set(normalizedTag, tag);
        }
      }
    }

    return [...tagByNormalized.values()].sort((left, right) => {
      const leftMealType = left.toLowerCase() as Recipe["mealType"];
      const rightMealType = right.toLowerCase() as Recipe["mealType"];
      const leftMealOrder = MEAL_TYPE_TAG_ORDER.get(leftMealType);
      const rightMealOrder = MEAL_TYPE_TAG_ORDER.get(rightMealType);

      if (leftMealOrder !== undefined || rightMealOrder !== undefined) {
        return (leftMealOrder ?? 99) - (rightMealOrder ?? 99);
      }

      return left.localeCompare(right, "en-US");
    });
  }, [recipes]);

  function toggleTagFilter(tag: string) {
    onBrowseStateChange({
      ...browseState,
      selectedTags: selectedTags.includes(tag)
        ? selectedTags.filter((selectedTag) => selectedTag !== tag)
        : [...selectedTags, tag],
    });
  }

  const filteredRecipes = useMemo(() => {
    const visibleRecipes = recipes.filter((recipe) => {
      const recipeTags = getRecipeTagSet(recipe);
      const matchesTags = normalizedSelectedTags.every((tag) =>
        recipeTags.has(tag),
      );
      return matchesTags && matchesSearch(recipe, searchTerm);
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
  }, [
    normalizedSelectedTags,
    recipes,
    searchTerm,
    validationByRecipeId,
  ]);

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
              <Button
                type="button"
                size="sm"
                variant={selectedTags.length === 0 ? "default" : "outline"}
                onClick={() =>
                  onBrowseStateChange({
                    ...browseState,
                    selectedTags: [],
                  })
                }
              >
                All tags
              </Button>
              {tagFilters.map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  size="sm"
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  onClick={() => toggleTagFilter(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Choose any recipe</Badge>
            </div>
          )}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-6 py-4">
        {filteredRecipes.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No recipes found — try adjusting the filters.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3 pb-4">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                showMealType={false}
                includeMealTypeTag
                maxTags={3}
                validation={validationByRecipeId.get(recipe.id)}
                onOpen={mode === "browse" ? () => onViewRecipe(recipe.id) : undefined}
                className="aspect-square"
                footer={
                  mode === "swap" && onSelectRecipe ? (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={() => onSelectRecipe(recipe.id)}
                    >
                      Use this recipe
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function RecipeBookCreate({
  inventory,
  dialogMode,
  onCreateCustomRecipe,
  onGenerateAndSwap,
  onRecipeCreated,
}: {
  inventory: InventoryItem[];
  dialogMode: "browse" | "swap";
  onCreateCustomRecipe: (payload: CreateRecipePayload) => Promise<string>;
  onGenerateAndSwap?: (payload: CreateRecipePayload) => Promise<void>;
  onRecipeCreated: (recipeId: string) => void;
}) {
  const [createMode, setCreateMode] = useState<"dish" | "ingredients">(
    dialogMode === "swap" ? "dish" : "ingredients",
  );
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
  const isDishMode = createMode === "dish";
  const canSubmit = isDishMode ? dishName.trim().length > 0 : selectedCount > 0;

  async function handleSubmit() {
    if (isDishMode && !dishName.trim()) {
      setSubmitError("Enter a dish name to generate a recipe.");
      return;
    }
    if (!isDishMode && selectedInventoryItemIds.length === 0) {
      setSubmitError("Pick at least one inventory item to build the recipe from.");
      return;
    }

    const payload: CreateRecipePayload = isDishMode
      ? { mode: "dish", dishName: dishName.trim(), preferences }
      : {
          mode: "ingredients",
          inventoryItemIds: selectedInventoryItemIds,
          preferences,
          dishName: dishName.trim() || undefined,
        };

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (dialogMode === "swap" && onGenerateAndSwap) {
        await onGenerateAndSwap(payload);
      } else {
        const recipeId = await onCreateCustomRecipe(payload);
        onRecipeCreated(recipeId);
      }
      setDishName("");
      setPreferences("");
      setSelectedInventoryItemIds([]);
      setInventorySearch("");
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

  const submitLabel = dialogMode === "swap" ? "Generate & use for this meal" : "Save recipe to book";

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className="grid gap-3">
          <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setCreateMode("dish")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isDishMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create a Recipe
            </button>
            <button
              type="button"
              onClick={() => setCreateMode("ingredients")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                !isDishMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Put together a meal
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isDishMode
              ? "Tell us the dish and we'll generate an authentic recipe using our own knowledge — regardless of what's in your kitchen. Anything missing will show up in your shopping list once this recipe is used in a plan."
              : "Pick ingredients you already have and we'll build a recipe around them."}
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="custom-recipe-name">Dish name</Label>
            <Input
              id="custom-recipe-name"
              placeholder={
                isDishMode
                  ? "e.g. Shakshuka, Pad Thai, Chicken Tikka Masala"
                  : "Optional, for example Spinach paneer toast"
              }
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
              {isDishMode ? null : `Selected inventory items: ${selectedCount}`}
            </div>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? "Generating recipe..." : submitLabel}
            </Button>
          </div>
        </div>
      </div>
      {isDishMode ? null : (
        <>
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
                    <ItemCard
                      key={item.id}
                      name={item.name}
                      emoji={item.emoji}
                      quantityLabel={formatItemQuantity(item.quantity, item.unit)}
                      detail={`${item.category}${item.expiresAt ? ` · expires ${item.expiresAt}` : ""}`}
                      selected={isSelected}
                      onClick={() => toggleInventoryItem(item.id)}
                      leading={
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleInventoryItem(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      }
                    />
                  );
                })}
                {filteredInventory.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    No items match — try a different search.
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}

function RecipeBookDetail({
  recipe,
  inventory,
  onBack,
  onDeleteRecipe,
}: {
  recipe: Recipe;
  inventory: InventoryItem[];
  onBack: () => void;
  onDeleteRecipe: (recipeId: string) => void;
}) {
  const validation = useMemo(
    () => validateRecipeAgainstInventory(recipe, inventory),
    [inventory, recipe],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RecipeDetailPanel
        recipe={recipe}
        validation={validation}
        onBack={onBack}
        onDelete={onDeleteRecipe}
      />
    </div>
  );
}

export function RecipeBookDialog({
  open,
  onOpenChange,
  recipes,
  inventory,
  mode = "browse",
  onSelectRecipe,
  onGenerateAndSwap,
  onCreateCustomRecipe,
  onDeleteRecipe,
}: RecipeBookDialogProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>();
  const [browseState, setBrowseState] = useState<RecipeBrowseState>({
    searchTerm: "",
    selectedTags: [],
  });
  const [view, setView] = useState<DialogView>("browse");
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId),
    [recipes, selectedRecipeId],
  );

  function handleViewRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId);
    setView("detail");
  }

  function handleRecipeCreated(recipeId: string) {
    setSelectedRecipeId(recipeId);
    setView("detail");
  }

  function handleBackToBrowse() {
    setView("browse");
  }

  function handleDeleteRecipe(recipeId: string) {
    if (!selectedRecipe || selectedRecipe.id !== recipeId) {
      return;
    }

    setSelectedRecipeId(undefined);
    setView("browse");
    onDeleteRecipe(recipeId);
  }

  function handleDrawerOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedRecipeId(undefined);
      setView("browse");
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
      ? "Pick any recipe from your book to fill this slot."
      : view === "detail"
        ? "Check ingredients, instructions, and cookability right here."
        : "Browse your saved recipes, see what you can cook today, and create new ones — by dish or by pantry.";

  return (
    <Drawer open={open} onOpenChange={handleDrawerOpenChange} direction="left">
      <DrawerContent className="h-svh w-[min(94vw,56rem)] max-w-[min(94vw,56rem)] overflow-hidden p-0 data-[vaul-drawer-direction=left]:w-[min(94vw,56rem)] data-[vaul-drawer-direction=left]:sm:max-w-[min(94vw,56rem)]">
        {view === "detail" ? (
          <DrawerHeader className="sr-only">
            <DrawerTitle>{headerTitle}</DrawerTitle>
            <DrawerDescription>{headerDescription}</DrawerDescription>
          </DrawerHeader>
        ) : (
          <DrawerHeader className="border-b px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <DrawerTitle>{headerTitle}</DrawerTitle>
                <DrawerDescription>{headerDescription}</DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Close recipe book"
                >
                  <XIcon className="size-4" aria-hidden />
                </Button>
              </DrawerClose>
            </div>
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
            </div>
          </DrawerHeader>
        )}
        {view === "detail" ? (
          <DrawerClose asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Close recipe book"
              className="absolute right-4 top-4 z-30 rounded-full bg-black/35 text-white shadow-sm backdrop-blur hover:bg-black/55 hover:text-white"
            >
              <XIcon className="size-4" aria-hidden />
            </Button>
          </DrawerClose>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col">
          {view === "detail" && selectedRecipe ? (
            <RecipeBookDetail
              recipe={selectedRecipe}
              inventory={inventory}
              onBack={handleBackToBrowse}
              onDeleteRecipe={handleDeleteRecipe}
            />
          ) : view === "create" ? (
            <RecipeBookCreate
              inventory={inventory}
              dialogMode={mode}
              onCreateCustomRecipe={onCreateCustomRecipe}
              onGenerateAndSwap={onGenerateAndSwap}
              onRecipeCreated={handleRecipeCreated}
            />
          ) : (
            <RecipeBookBrowse
              recipes={recipes}
              inventory={inventory}
              mode={mode}
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
