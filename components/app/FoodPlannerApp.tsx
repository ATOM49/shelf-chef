"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { WeeklyPlanList } from "@/components/planner/WeeklyPlanList";
import { HouseholdSettingsDialog } from "@/components/households/HouseholdSettingsDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  LOTTIE_ANIMATION_SOURCES,
  LottieLoadingPanel,
} from "@/components/ui/lottie-loading-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RecipeBookDialog } from "@/components/planner/RecipeBookDialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StorageCanvas } from "@/components/storage/StorageCanvas";
import { StorageEditorPanel } from "@/components/storage/StorageEditorPanel";
import { StaplesPanel } from "@/components/storage/StaplesPanel";
import { GroceryCartPanel } from "@/components/planner/GroceryCartPanel";
import { PlannerSidebar } from "@/components/planner/PlannerSidebar";
import { StockingDialog } from "@/components/stocking/StockingDialog";
import {
  appReducer,
  arePlannerConfigsEqual,
  createDefaultAppState,
  createPlannerConfigSnapshot,
} from "@/lib/appState";
import type { StockingItemDraft } from "@/lib/appState";
import {
  parseCustomRecipeGenerationApiResponse,
  parsePlannerGenerationApiResponse,
} from "@/lib/planner/schema";
import type {
  GroceryCartItem,
  PlannedMeal,
  PlannerGenerationApiResponse,
  PlannerGenerationRequest,
  PlannedMealType,
  PlannerWeekDay,
  PreferredDishRequest,
} from "@/lib/planner/types";
import {
  clearWorkspaceAppState,
  loadWorkspaceAppState,
  loadWorkspacePreference,
  parsePersistedAppState,
  saveWorkspaceAppState,
  saveWorkspacePreference,
} from "@/lib/persistence";
import { useSession } from "next-auth/react";
import {
  DEFAULT_WORKSPACE,
  isHouseholdWorkspace,
  normalizeWorkspace,
  parseSerializedWorkspace,
  serializeWorkspace,
  type HouseholdSummary,
  type Workspace,
} from "@/lib/households/shared";
import {
  BookOpen,
  CircleHelp,
  Copy,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  PackagePlus,
  Settings2,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  XIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MobileTab = "storage" | "planner";
type StorageTab = "fridge" | "pantry" | "staples";

type RecipeBookState = {
  open: boolean;
  mode: "browse" | "swap";
  mealId?: string;
  swapMealType?: PlannedMealType;
  fillDay?: PlannerWeekDay;
  fillMealType?: PlannedMealType;
};

function formatCartItemQuantity(quantity: number) {
  return Number.isInteger(quantity) ? quantity : quantity.toFixed(1);
}

export function FoodPlannerApp() {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(() =>
    loadWorkspacePreference(),
  );
  const [state, dispatch] = useReducer(
    appReducer,
    activeWorkspace,
    loadWorkspaceAppState,
  );
  const latestStateRef = useRef(state);
  const resetPendingRef = useRef(false);
  const loadingDbStateRef = useRef(false);
  const isDbStateLoadedRef = useRef(false);
  const loadedWorkspaceKeyRef = useRef<string | null>(null);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: session, status: sessionStatus } = useSession();

  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [householdsReady, setHouseholdsReady] = useState(false);
  const [householdsError, setHouseholdsError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [storageTab, setStorageTab] = useState<StorageTab>("fridge");
  const [stockingOpen, setStockingOpen] = useState(false);
  const [selectedShelfId, setSelectedShelfId] = useState<string | undefined>();
  const [selectedCell, setSelectedCell] = useState<
    { shelfId: string; cellId: string } | undefined
  >();
  const [selectedPantryShelfId, setSelectedPantryShelfId] = useState<
    string | undefined
  >();
  const [selectedPantryCell, setSelectedPantryCell] = useState<
    { shelfId: string; cellId: string } | undefined
  >();
  const [cartOpen, setCartOpen] = useState(false);
  const [plannerSettingsOpen, setPlannerSettingsOpen] = useState(false);
  const [householdSettingsOpen, setHouseholdSettingsOpen] = useState(false);
  const [recipeBookState, setRecipeBookState] = useState<RecipeBookState>({
    open: false,
    mode: "browse",
  });
  const [mobileTab, setMobileTab] = useState<MobileTab>("storage");
  const [clearPlanDialogOpen, setClearPlanDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [plannerApiError, setPlannerApiError] = useState<string | null>(null);
  const [isPlannerPending, setIsPlannerPending] = useState(false);
  const [cartCopyError, setCartCopyError] = useState<string | null>(null);
  const fridgeInventory = state.inventory.filter(
    (item) => item.storageId === state.fridge.id,
  );
  const pantryInventory = state.inventory.filter(
    (item) => item.storageId === state.pantry.id,
  );
  const uncheckedCartCount = state.planner.groceryCart.filter(
    (item) => !item.checked,
  ).length;
  const hasPlan = state.planner.weeklyPlan.length > 0;
  const savedPlannerConfig = createPlannerConfigSnapshot(state.planner);
  const isPlanStale = hasPlan
    ? !state.planner.lastGeneratedConfig ||
      !arePlannerConfigsEqual(
        savedPlannerConfig,
        state.planner.lastGeneratedConfig,
      )
    : false;
  const planActionLabel = "Create plan";
  const requiredCartItems = state.planner.groceryCart.filter(
    (item) => item.reason === "missing",
  );
  const lowStockCartItems = state.planner.groceryCart.filter(
    (item) => item.reason === "low",
  );
  const canUseClipboard =
    typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;
  const activeHousehold = isHouseholdWorkspace(activeWorkspace)
    ? households.find((household) => household.id === activeWorkspace.householdId)
    : undefined;
  const activeWorkspaceLabel = activeHousehold?.name ?? "Personal workspace";

  const buildStateUrl = useCallback((workspace: Workspace) => {
    if (!isHouseholdWorkspace(workspace)) {
      return "/api/state";
    }

    const searchParams = new URLSearchParams({
      workspace: "household",
      householdId: workspace.householdId,
    });
    return `/api/state?${searchParams.toString()}`;
  }, []);

  const refreshHouseholds = useCallback(async () => {
    const response = await fetch("/api/households");
    const data = (await response.json()) as {
      error?: string;
      households?: HouseholdSummary[];
    };

    if (!response.ok || !data.households) {
      throw new Error(data.error ?? "Unable to load households");
    }

    setHouseholds(data.households);
    setHouseholdsError(null);

    const normalized = normalizeWorkspace(activeWorkspace, data.households);
    if (serializeWorkspace(normalized) !== serializeWorkspace(activeWorkspace)) {
      setActiveWorkspace(normalized);
    }

    return data.households;
  }, [activeWorkspace]);

  const handleCopyCartSection = useCallback(
    (items: GroceryCartItem[]): void => {
      setCartCopyError(null);
      if (!canUseClipboard || items.length === 0) return;

      const uncheckedItems = items.filter((item) => !item.checked);
      const itemsToCopy = uncheckedItems.length > 0 ? uncheckedItems : items;
      const shoppingListText = itemsToCopy
        .map(
          (item) =>
            `- ${item.displayName} — ${formatCartItemQuantity(item.neededQuantity)} ${item.unit}`,
        )
        .join("\n");

      void navigator.clipboard.writeText(shoppingListText).catch(() => {
        setCartCopyError(
          "Clipboard access denied. Please check your browser permissions.",
        );
      });
    },
    [canUseClipboard],
  );

  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (sessionStatus === "unauthenticated") {
      isDbStateLoadedRef.current = true;
      loadedWorkspaceKeyRef.current = serializeWorkspace(DEFAULT_WORKSPACE);
      setHouseholds([]);
      setHouseholdsReady(true);
      setIsInitializing(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        setIsInitializing(true);
        setHouseholdsReady(false);
        await refreshHouseholds();
      } catch (error) {
        if (!isCancelled) {
          setHouseholdsError(
            error instanceof Error ? error.message : "Unable to load households",
          );
        }
      } finally {
        if (!isCancelled) {
          setHouseholdsReady(true);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [refreshHouseholds, sessionStatus]);

  useEffect(() => {
    saveWorkspacePreference(activeWorkspace);
  }, [activeWorkspace]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !householdsReady) {
      return;
    }

    const normalizedWorkspace = normalizeWorkspace(activeWorkspace, households);
    if (
      serializeWorkspace(normalizedWorkspace) !== serializeWorkspace(activeWorkspace)
    ) {
      setActiveWorkspace(normalizedWorkspace);
      return;
    }

    const workspaceKey = serializeWorkspace(normalizedWorkspace);
    const localState = loadWorkspaceAppState(normalizedWorkspace);
    let isCancelled = false;

    loadedWorkspaceKeyRef.current = null;
    isDbStateLoadedRef.current = false;
    loadingDbStateRef.current = true;
    setWorkspaceError(null);
    setIsInitializing(true);
    dispatch({ type: "LOAD_STATE", state: localState });

    void (async () => {
      try {
        const response = await fetch(buildStateUrl(normalizedWorkspace));
        const data = (await response.json()) as { error?: string; state?: unknown };

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load workspace state");
        }

        const revived = data.state
          ? parsePersistedAppState(data.state) ?? createDefaultAppState()
          : createDefaultAppState();

        if (!isCancelled) {
          loadingDbStateRef.current = true;
          dispatch({ type: "LOAD_STATE", state: revived });
        }
      } catch (error) {
        if (!isCancelled) {
          setWorkspaceError(
            error instanceof Error
              ? error.message
              : "Unable to load workspace state",
          );
        }
      } finally {
        if (!isCancelled) {
          loadedWorkspaceKeyRef.current = workspaceKey;
          isDbStateLoadedRef.current = true;
          setIsInitializing(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [activeWorkspace, buildStateUrl, households, householdsReady, sessionStatus]);

  // Save state to localStorage on every change; also debounce-save to DB when authenticated.
  useLayoutEffect(() => {
    latestStateRef.current = state;

    const workspaceKey = serializeWorkspace(activeWorkspace);
    if (loadedWorkspaceKeyRef.current !== workspaceKey) {
      return;
    }

    saveWorkspaceAppState(activeWorkspace, state);

    if (loadingDbStateRef.current) {
      loadingDbStateRef.current = false;
      resetPendingRef.current = false;
      return;
    }

    resetPendingRef.current = false;

    if (session?.user?.id && isDbStateLoadedRef.current) {
      if (dbSaveTimerRef.current !== undefined) {
        clearTimeout(dbSaveTimerRef.current);
      }
      dbSaveTimerRef.current = setTimeout(() => {
        void fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: latestStateRef.current,
            workspace: activeWorkspace,
          }),
        });
      }, 1500);
    }
  }, [activeWorkspace, session?.user?.id, state]);

  useEffect(() => {
    const flushState = () => {
      if (resetPendingRef.current) {
        return;
      }

      const workspaceKey = serializeWorkspace(activeWorkspace);
      if (loadedWorkspaceKeyRef.current !== workspaceKey) {
        return;
      }

      saveWorkspaceAppState(activeWorkspace, latestStateRef.current);

      if (session?.user?.id && isDbStateLoadedRef.current) {
        if (dbSaveTimerRef.current !== undefined) {
          clearTimeout(dbSaveTimerRef.current);
          dbSaveTimerRef.current = undefined;
        }
        void fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: latestStateRef.current,
            workspace: activeWorkspace,
          }),
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushState();
      }
    };

    window.addEventListener("pagehide", flushState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeWorkspace, session?.user?.id]);

  const handleSelectShelf = useCallback((shelfId: string) => {
    setSelectedShelfId(shelfId);
    setSelectedCell(undefined);
    setStorageTab("fridge");
    setMobileTab("storage");
  }, []);

  const handleSelectCell = useCallback((shelfId: string, cellId: string) => {
    setSelectedShelfId(shelfId);
    setSelectedCell({ shelfId, cellId });
    setStorageTab("fridge");
    setMobileTab("storage");
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedShelfId(undefined);
    setSelectedCell(undefined);
  }, []);

  const handleSelectPantryShelf = useCallback((shelfId: string) => {
    setSelectedPantryShelfId(shelfId);
    setSelectedPantryCell(undefined);
    setStorageTab("pantry");
    setMobileTab("storage");
  }, []);

  const handleSelectPantryCell = useCallback(
    (shelfId: string, cellId: string) => {
      setSelectedPantryShelfId(shelfId);
      setSelectedPantryCell({ shelfId, cellId });
      setStorageTab("pantry");
      setMobileTab("storage");
    },
    [],
  );

  const handleClearPantrySelection = useCallback(() => {
    setSelectedPantryShelfId(undefined);
    setSelectedPantryCell(undefined);
  }, []);

  const handleWorkspaceChange = useCallback(
    (workspace: Workspace) => {
      const normalizedWorkspace = normalizeWorkspace(workspace, households);
      loadedWorkspaceKeyRef.current = null;
      setActiveWorkspace(normalizedWorkspace);
      setPlannerApiError(null);
      setCartOpen(false);
      setPlannerSettingsOpen(false);
      setHouseholdSettingsOpen(false);
      setMobileTab("storage");
      handleClearSelection();
      handleClearPantrySelection();
    },
    [handleClearPantrySelection, handleClearSelection, households],
  );

  const handleReorderFridgeShelves = useCallback(
    (activeShelfId: string, overShelfId: string) => {
      dispatch({
        type: "REORDER_SHELVES",
        target: "fridge",
        activeShelfId,
        overShelfId,
      });
    },
    [],
  );

  const handleReorderPantryShelves = useCallback(
    (activeShelfId: string, overShelfId: string) => {
      dispatch({
        type: "REORDER_SHELVES",
        target: "pantry",
        activeShelfId,
        overShelfId,
      });
    },
    [],
  );

  const handleCommitStock = useCallback((items: StockingItemDraft[]) => {
    dispatch({ type: "STOCK_ITEMS", items });
  }, []);

  const handleGeneratePlan = useCallback(() => {
    setPlannerApiError(null);
    setIsPlannerPending(true);
    void (async () => {
      try {
        const payload: PlannerGenerationRequest = {
          inventory: state.inventory.map((item) => ({
            name: item.name,
            normalizedName: item.normalizedName,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            expiresAt: item.expiresAt,
          })),
          preferences: state.planner.preferences,
          preferredDishes: state.planner.preferredDishes.map((dish) => ({
            name: dish.name,
            mealType: dish.mealType,
          })),
          mealTypes: state.planner.selectedMealTypes,
          recipeBook: state.recipes,
        };

        const response = await fetch("/api/planner/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const err = (await response.json()) as {
            error?: string;
            detail?: string;
          };
          throw new Error(err.detail || err.error || `HTTP ${response.status}`);
        }

        const rawData = (await response.json()) as PlannerGenerationApiResponse;
        const data = parsePlannerGenerationApiResponse(rawData);
        dispatch({
          type: "APPLY_GENERATED_PLAN",
          recipes: data.recipes,
          mealSlots: data.mealSlots,
        });
      } catch (err) {
        setPlannerApiError(
          err instanceof Error ? err.message : "Unknown planner error",
        );
      } finally {
        setIsPlannerPending(false);
      }
    })();
  }, [
    state.inventory,
    state.planner.preferences,
    state.planner.selectedMealTypes,
    state.planner.preferredDishes,
    state.recipes,
  ]);

  const handleSavePlannerSettings = useCallback(
    (payload: {
      preferences: string;
      selectedMealTypes: Array<PlannedMeal["mealType"]>;
      preferredDishes: Array<
        Pick<PreferredDishRequest, "id" | "name" | "mealType">
      >;
    }) => {
      dispatch({ type: "SET_PREFERENCES", preferences: payload.preferences });
      dispatch({
        type: "SET_PLANNER_MEAL_TYPES",
        mealTypes: payload.selectedMealTypes,
      });
      dispatch({
        type: "SET_PREFERRED_DISHES",
        preferredDishes: payload.preferredDishes,
      });
      setPlannerSettingsOpen(false);
    },
    [],
  );

  const handleOpenRecipeBook = useCallback(() => {
    setRecipeBookState({ open: true, mode: "browse" });
  }, []);

  const handleOpenSwapRecipeBook = useCallback(
    (mealId: string) => {
      const meal = state.planner.weeklyPlan.find(
        (candidate) => candidate.id === mealId,
      );
      if (!meal) {
        return;
      }

      setRecipeBookState({
        open: true,
        mode: "swap",
        mealId,
        swapMealType: meal.mealType,
      });
    },
    [state.planner.weeklyPlan],
  );

  const handleAddMealToSlot = useCallback(
    (day: PlannerWeekDay, mealType: PlannedMealType) => {
      setRecipeBookState({
        open: true,
        mode: "swap",
        swapMealType: mealType,
        fillDay: day,
        fillMealType: mealType,
      });
    },
    [],
  );

  const handleRecipeBookOpenChange = useCallback((open: boolean) => {
    setRecipeBookState((current) =>
      open
        ? current
        : {
            open: false,
            mode: "browse",
          },
    );
  }, []);

  const handleSwapRecipeSelection = useCallback(
    (recipeId: string) => {
      if (recipeBookState.mealId) {
        dispatch({
          type: "REPLACE_PLANNED_MEAL",
          mealId: recipeBookState.mealId,
          recipeId,
        });
      } else if (recipeBookState.fillDay && recipeBookState.fillMealType) {
        dispatch({
          type: "ADD_MEAL_TO_SLOT",
          day: recipeBookState.fillDay,
          mealType: recipeBookState.fillMealType,
          recipeId,
        });
      } else {
        return;
      }
      setRecipeBookState({ open: false, mode: "browse" });
    },
    [recipeBookState.mealId, recipeBookState.fillDay, recipeBookState.fillMealType],
  );

  const handleCreateCustomRecipe = useCallback(
    async (payload: {
      inventoryItemIds: string[];
      preferences: string;
      dishName: string;
    }) => {
      const inventorySubset = state.inventory
        .filter((item) => payload.inventoryItemIds.includes(item.id))
        .map((item) => ({
          name: item.name,
          normalizedName: item.normalizedName,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          expiresAt: item.expiresAt,
        }));

      const response = await fetch("/api/recipes/generate/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory: inventorySubset,
          preferences: payload.preferences,
          dishName: payload.dishName.trim() || undefined,
          recipeBook: state.recipes,
        }),
      });

      if (!response.ok) {
        const err = (await response.json()) as {
          error?: string;
          detail?: string;
        };
        throw new Error(err.detail || err.error || `HTTP ${response.status}`);
      }

      const rawData = await response.json();
      const data = parseCustomRecipeGenerationApiResponse(rawData);

      dispatch({ type: "ADD_CUSTOM_RECIPE", recipe: data.recipe });
      return data.recipe.id;
    },
    [state.inventory, state.recipes],
  );

  const handleGenerateAndSwap = useCallback(
    async (dishName: string) => {
      const allInventoryIds = state.inventory.map((item) => item.id);
      const recipeId = await handleCreateCustomRecipe({
        inventoryItemIds: allInventoryIds,
        preferences: state.planner.preferences,
        dishName,
      });

      if (recipeBookState.mealId) {
        dispatch({ type: "REPLACE_PLANNED_MEAL", mealId: recipeBookState.mealId, recipeId });
      } else if (recipeBookState.fillDay && recipeBookState.fillMealType) {
        dispatch({
          type: "ADD_MEAL_TO_SLOT",
          day: recipeBookState.fillDay,
          mealType: recipeBookState.fillMealType,
          recipeId,
        });
      } else {
        return;
      }
      setRecipeBookState({ open: false, mode: "browse" });
    },
    [
      recipeBookState.mealId,
      recipeBookState.fillDay,
      recipeBookState.fillMealType,
      state.inventory,
      state.planner.preferences,
      handleCreateCustomRecipe,
    ],
  );

  const handleDeleteCustomRecipe = useCallback((recipeId: string) => {
    dispatch({ type: "REMOVE_CUSTOM_RECIPE", recipeId });
  }, []);

  const handleConfirmClearPlan = useCallback(() => {
    setPlannerApiError(null);
    dispatch({ type: "CLEAR_WEEKLY_PLAN" });
    setClearPlanDialogOpen(false);
  }, []);

  const handleReset = () => {
    setResetDialogOpen(true);
  };

  const handleConfirmReset = () => {
    resetPendingRef.current = true;
    clearWorkspaceAppState(activeWorkspace);
    if (session?.user?.id) {
      void fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: null, workspace: activeWorkspace }),
      });
    }
    dispatch({ type: "RESET_APP" });
    handleClearSelection();
    handleClearPantrySelection();
    setCartOpen(false);
    setPlannerSettingsOpen(false);
    setMobileTab("storage");
    setPlannerApiError(null);
    setResetDialogOpen(false);
  };

  function renderPlannerMainContent() {
    const plannerLoadingState = (
      <LottieLoadingPanel
        src={LOTTIE_ANIMATION_SOURCES.planner}
        title={
          hasPlan ? "Refreshing your weekly plan" : "Building your weekly plan"
        }
        description={
          hasPlan
            ? "Reworking recipes and meal slots with your latest settings and current inventory."
            : "Matching recipes to your inventory, applying your preferences, and laying out the week."
        }
        statusLabel="Generating plan"
        className="min-h-[24rem]"
        panelClassName="max-w-lg"
        animationClassName="scale-[0.92]"
      />
    );

    return (
      <section
        aria-busy={isPlannerPending}
        className="flex min-h-0 w-full flex-1 flex-col rounded-xl border bg-muted/20 p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                This week&apos;s plan
              </h2>
              {isPlanStale ? (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-700"
                >
                  Saved settings not used for this plan
                </Badge>
              ) : null}
            </div>
            {/* <p className="text-sm text-muted-foreground">
              Drag meals across the week, inspect recipe details, and validate
              against inventory before cooking.
            </p> */}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasPlan ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setClearPlanDialogOpen(true)}
                disabled={isPlannerPending}
                aria-label="Clear plan"
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="hidden sm:inline">Clear plan</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setPlannerSettingsOpen(true)}
              disabled={isPlannerPending}
              aria-label="Customise plan"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              <span className="hidden sm:inline">Customise plan</span>
            </Button>
            <Button
              type="button"
              onClick={handleGeneratePlan}
              disabled={isPlannerPending}
              className="whitespace-nowrap"
              aria-label="Create plan"
            >
              <Sparkles className="size-4" aria-hidden />
              {isPlannerPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  <span>{planActionLabel}</span>
                </>
              ) : (
                planActionLabel
              )}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {plannerApiError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {plannerApiError}
            </div>
          ) : null}
        </div>

        <div className="mt-3 min-h-0 flex-1">
          {isPlannerPending && !hasPlan ? (
            plannerLoadingState
          ) : (
            <div className="relative h-full">
              <WeeklyPlanList
                meals={state.planner.weeklyPlan}
                visibleMealTypes={state.planner.selectedMealTypes}
                selectedMealId={state.planner.selectedMealId}
                onSelectMeal={(mealId) =>
                  dispatch({ type: "SELECT_MEAL", mealId })
                }
                onSetMealCooked={(mealId, cooked) =>
                  dispatch({ type: "SET_MEAL_COOKED", mealId, cooked })
                }
                onMoveMealSlot={(mealId, day, mealType) =>
                  dispatch({
                    type: "MOVE_PLANNED_MEAL_SLOT",
                    mealId,
                    day,
                    mealType,
                  })
                }
                onSwapMeal={handleOpenSwapRecipeBook}
                onRemoveMeal={(mealId) =>
                  dispatch({ type: "REMOVE_PLANNED_MEAL", mealId })
                }
                onAddMealToSlot={handleAddMealToSlot}
                onDeselectMeal={() =>
                  dispatch({ type: "SELECT_MEAL", mealId: undefined })
                }
              />

              {isPlannerPending ? (
                <div className="absolute inset-0 z-10 rounded-xl bg-background/78 p-3 supports-backdrop-filter:backdrop-blur-xs">
                  <LottieLoadingPanel
                    src={LOTTIE_ANIMATION_SOURCES.planner}
                    title="Refreshing your weekly plan"
                    description="Keeping your current plan visible while regenerating a new week in the background."
                    statusLabel="Updating plan"
                    className="h-full"
                    panelClassName="max-w-lg"
                    animationClassName="scale-[0.92]"
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    );
  }

  const groceryCartContent =
    state.planner.groceryCart.length > 0 ? (
      <GroceryCartPanel
        items={state.planner.groceryCart}
        onToggle={(id) => dispatch({ type: "TOGGLE_GROCERY_ITEM", itemId: id })}
        onCopyMissing={() => handleCopyCartSection(requiredCartItems)}
        onCopyLowStock={() => handleCopyCartSection(lowStockCartItems)}
        canUseClipboard={canUseClipboard}
      />
    ) : (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Grocery cart is empty. Generate a weekly plan first.
      </div>
    );

  if (isInitializing) {
    return (
      <div className="flex h-svh items-center justify-center bg-muted/30">
        <LottieLoadingPanel
          src={LOTTIE_ANIMATION_SOURCES.planner}
          title="Loading your ShelfChef"
          description="Syncing your inventory, recipes, and meal plan."
          statusLabel="Loading"
          className="min-h-[16rem]"
          panelClassName="max-w-sm"
          animationClassName="scale-90"
        />
      </div>
    );
  }

  return (
    <div className="h-svh overflow-hidden bg-muted/30">
      <div className="mx-auto flex h-full max-w-screen-2xl flex-col p-3 md:p-4">
        <header className="shrink-0 rounded-xl border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍽️</span>
              <h1 className="text-lg font-semibold">ShelfChef</h1>
              <Popover>
                <PopoverTrigger
                  type="button"
                  aria-label="What ShelfChef helps you do"
                  className="inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none"
                >
                  <CircleHelp className="size-4" aria-hidden />
                </PopoverTrigger>
                <PopoverContent sideOffset={8} className="w-80 p-3">
                  <PopoverHeader>
                    <PopoverTitle>What ShelfChef helps you do</PopoverTitle>
                    <PopoverDescription>
                      Manage inventory stock, create recipes with ingredients,
                      and plan your weekly menu so you can better manage your
                      groceries.
                    </PopoverDescription>
                  </PopoverHeader>
                </PopoverContent>
              </Popover>
            </div>
            {/* Desktop actions */}
            <TooltipProvider>
              <div className="hidden items-center gap-2 md:flex">
                <Select
                  value={serializeWorkspace(activeWorkspace)}
                  onValueChange={(value) =>
                    handleWorkspaceChange(parseSerializedWorkspace(value))
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue>{activeWorkspaceLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">👤 Personal workspace</SelectItem>
                    {households.map((household) => (
                      <SelectItem
                        key={household.id}
                        value={`household:${household.id}`}
                      >
                        🏠 {household.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label="Household settings"
                    onClick={() => setHouseholdSettingsOpen(true)}
                    className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                  >
                    <Settings2 className="size-4" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Household settings</TooltipContent>
                </Tooltip>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleOpenRecipeBook}
                  disabled={isPlannerPending}
                >
                  <BookOpen className="size-4" aria-hidden />
                  Recipe book
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCartOpen(true)}
                  aria-label="Shopping cart"
                  className="relative"
                >
                  <ShoppingCart className="size-4" aria-hidden />
                  {uncheckedCartCount > 0 ? (
                    <Badge className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]">
                      {uncheckedCartCount}
                    </Badge>
                  ) : null}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    type="button"
                    aria-label="More options"
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end" sideOffset={6}>
                    <DropdownMenuLinkItem href="/signout">
                      <LogOut className="size-4" aria-hidden />
                      Sign out
                    </DropdownMenuLinkItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={handleReset}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Reset workspace
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TooltipProvider>

            {/* Mobile actions */}
            <div className="flex items-center gap-2 md:hidden">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={handleOpenRecipeBook}
                disabled={isPlannerPending}
                aria-label="Recipe book"
              >
                <BookOpen className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCartOpen(true)}
                aria-label="Shopping cart"
                className="relative"
              >
                <ShoppingCart className="size-4" aria-hidden />
                {uncheckedCartCount > 0 ? (
                  <Badge className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]">
                    {uncheckedCartCount}
                  </Badge>
                ) : null}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  aria-label="More options"
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="w-56">
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={serializeWorkspace(activeWorkspace)}
                    onValueChange={(value) =>
                      handleWorkspaceChange(parseSerializedWorkspace(value))
                    }
                  >
                    <DropdownMenuRadioItem value="personal">
                      👤 Personal
                    </DropdownMenuRadioItem>
                    {households.map((household) => (
                      <DropdownMenuRadioItem
                        key={household.id}
                        value={`household:${household.id}`}
                      >
                        🏠 {household.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setHouseholdSettingsOpen(true)}>
                    <Settings2 className="size-4" aria-hidden />
                    Household settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLinkItem href="/signout">
                    <LogOut className="size-4" aria-hidden />
                    Sign out
                  </DropdownMenuLinkItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleReset}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Reset workspace
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {(householdsError || workspaceError) ? (
          <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {householdsError ?? workspaceError}
          </div>
        ) : null}

        <div className="mt-3 flex min-h-0 flex-1 gap-3">
          <div className="hidden min-h-0 w-96 shrink-0 flex-col rounded-xl border bg-card p-3 md:flex">
            <Tabs
              value={storageTab}
              onValueChange={(v) => setStorageTab(v as StorageTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="mb-3 flex items-center gap-2">
                <TabsList className="grid flex-1 grid-cols-3 shrink-0">
                  <TabsTrigger value="fridge">🧊 Fridge</TabsTrigger>
                  <TabsTrigger value="pantry">🗄️ Pantry</TabsTrigger>
                  <TabsTrigger value="staples">🧂 Staples</TabsTrigger>
                </TabsList>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setStockingOpen(true)}
                  aria-label="Stock items"
                >
                  <PackagePlus className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Stock items</span>
                </Button>
              </div>
              <TabsContent
                value="fridge"
                className="mt-2 min-h-0 flex-1 overflow-hidden"
              >
                <StorageCanvas
                  layout={state.fridge}
                  inventory={fridgeInventory}
                  selectedShelfId={selectedShelfId}
                  onSelectShelf={handleSelectShelf}
                  onSelectCell={handleSelectCell}
                  onReorderShelves={handleReorderFridgeShelves}
                />
              </TabsContent>
              <TabsContent
                value="pantry"
                className="mt-2 min-h-0 flex-1 overflow-hidden"
              >
                <StorageCanvas
                  layout={state.pantry}
                  inventory={pantryInventory}
                  selectedShelfId={selectedPantryShelfId}
                  onSelectShelf={handleSelectPantryShelf}
                  onSelectCell={handleSelectPantryCell}
                  onReorderShelves={handleReorderPantryShelves}
                />
              </TabsContent>
              <TabsContent
                value="staples"
                className="mt-2 min-h-0 flex-1 overflow-y-auto"
              >
                <StaplesPanel
                  customStapleNames={state.customStapleNames}
                  onAddStaples={(names) =>
                    dispatch({ type: "ADD_CUSTOM_STAPLES", names })
                  }
                  onRemoveStaple={(name) =>
                    dispatch({ type: "REMOVE_CUSTOM_STAPLE", name })
                  }
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="min-h-0 min-w-0 flex-1 rounded-xl border bg-card p-3 md:p-4">
            <div className="hidden h-full md:flex md:min-h-0">
              {renderPlannerMainContent()}
            </div>

            <div className="h-full md:hidden">
              <Tabs
                value={mobileTab}
                onValueChange={(value) => setMobileTab(value as MobileTab)}
                className="h-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="storage">Storage</TabsTrigger>
                  <TabsTrigger value="planner">Planner</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="storage"
                  className="mt-3 flex h-[calc(100%-2.5rem)] min-h-0 flex-col overflow-hidden"
                >
                  <div className="flex h-full min-h-0 flex-col gap-3">
                    <Tabs
                      value={storageTab}
                      onValueChange={(v) => setStorageTab(v as StorageTab)}
                      className="shrink-0 gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <TabsList className="grid flex-1 grid-cols-3">
                          <TabsTrigger value="fridge">🧊 Fridge</TabsTrigger>
                          <TabsTrigger value="pantry">🗄️ Pantry</TabsTrigger>
                          <TabsTrigger value="staples">🧂 Staples</TabsTrigger>
                        </TabsList>
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setStockingOpen(true)}
                          aria-label="Stock items"
                        >
                          <PackagePlus className="size-4" aria-hidden />
                          <span className="hidden sm:inline">Stock items</span>
                        </Button>
                      </div>
                    </Tabs>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {storageTab === "fridge" ? (
                        <StorageCanvas
                          layout={state.fridge}
                          inventory={fridgeInventory}
                          selectedShelfId={selectedShelfId}
                          onSelectShelf={handleSelectShelf}
                          onSelectCell={handleSelectCell}
                          onReorderShelves={handleReorderFridgeShelves}
                        />
                      ) : storageTab === "pantry" ? (
                        <StorageCanvas
                          layout={state.pantry}
                          inventory={pantryInventory}
                          selectedShelfId={selectedPantryShelfId}
                          onSelectShelf={handleSelectPantryShelf}
                          onSelectCell={handleSelectPantryCell}
                          onReorderShelves={handleReorderPantryShelves}
                        />
                      ) : (
                        <StaplesPanel
                          customStapleNames={state.customStapleNames}
                          onAddStaples={(names) =>
                            dispatch({ type: "ADD_CUSTOM_STAPLES", names })
                          }
                          onRemoveStaple={(name) =>
                            dispatch({ type: "REMOVE_CUSTOM_STAPLE", name })
                          }
                        />
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      Stock items first to let AI build out fridge and pantry
                      shelves for you.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent
                  value="planner"
                  className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1"
                >
                  {renderPlannerMainContent()}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <StorageEditorPanel
          storage={state.fridge}
          inventory={state.inventory}
          selectedShelfId={selectedShelfId}
          selectedCell={selectedCell}
          dispatch={dispatch}
          onClearSelection={handleClearSelection}
          showInlinePanel={false}
        />
        <StorageEditorPanel
          storage={state.pantry}
          inventory={state.inventory}
          selectedShelfId={selectedPantryShelfId}
          selectedCell={selectedPantryCell}
          dispatch={dispatch}
          onClearSelection={handleClearPantrySelection}
          showInlinePanel={false}
        />
        <StockingDialog
          open={stockingOpen}
          onOpenChange={setStockingOpen}
          onCommit={handleCommitStock}
          customStapleNames={state.customStapleNames}
        />
        <HouseholdSettingsDialog
          open={householdSettingsOpen}
          onOpenChange={setHouseholdSettingsOpen}
          household={activeHousehold}
          currentUserId={session?.user?.id}
          onHouseholdsChanged={refreshHouseholds}
          onWorkspaceChange={handleWorkspaceChange}
        />
        <Drawer
          direction="bottom"
          open={plannerSettingsOpen}
          onOpenChange={setPlannerSettingsOpen}
        >
          <DrawerContent>
            <DrawerClose
              aria-label="Close planner settings"
              className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DrawerClose>
            <DrawerHeader className="pr-12">
              <DrawerTitle>Customise plan</DrawerTitle>
              <DrawerDescription>
                Save planner preferences and preferred dishes here, then create
                or recreate the week from the planner header.
              </DrawerDescription>
            </DrawerHeader>
            <PlannerSidebar
              key={`${plannerSettingsOpen ? "open" : "closed"}::${state.planner.preferences}::${state.planner.preferredDishes
                .map((dish) => `${dish.id}:${dish.name}:${dish.mealType ?? ""}`)
                .join("|")}::${state.planner.selectedMealTypes.join(",")}`}
              savedPreferences={state.planner.preferences}
              savedSelectedMealTypes={state.planner.selectedMealTypes}
              savedPreferredDishes={state.planner.preferredDishes}
              onSave={handleSavePlannerSettings}
              onCancel={() => setPlannerSettingsOpen(false)}
              isDisabled={isPlannerPending}
            />
          </DrawerContent>
        </Drawer>
        <Drawer direction="right" open={cartOpen} onOpenChange={setCartOpen}>
          <DrawerContent>
            <DrawerClose
              aria-label="Close shopping cart"
              className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DrawerClose>
            <DrawerHeader className="pr-12">
              <DrawerTitle>Shopping cart</DrawerTitle>
              <DrawerDescription>
                Review missing and low-stock ingredients from your current
                weekly plan.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {groceryCartContent}
            </div>
            <div className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur">
              <Button
                type="button"
                className="w-full"
                onClick={() => handleCopyCartSection(state.planner.groceryCart)}
                disabled={state.planner.groceryCart.length === 0 || !canUseClipboard}
              >
                <Copy className="size-4" aria-hidden="true" />
                Copy shopping list
              </Button>
              {cartCopyError ? (
                <p className="mt-2 text-xs text-destructive">{cartCopyError}</p>
              ) : null}
            </div>
          </DrawerContent>
        </Drawer>
        <RecipeBookDialog
          key={`${recipeBookState.mode}:${recipeBookState.mealId ?? "none"}:${recipeBookState.open ? "open" : "closed"}`}
          open={recipeBookState.open}
          onOpenChange={handleRecipeBookOpenChange}
          recipes={state.recipes}
          inventory={state.inventory}
          mode={recipeBookState.mode}
          swapMealType={recipeBookState.swapMealType}
          onSelectRecipe={
            recipeBookState.mode === "swap"
              ? handleSwapRecipeSelection
              : undefined
          }
          onGenerateAndSwap={
            recipeBookState.mode === "swap" ? handleGenerateAndSwap : undefined
          }
          onCreateCustomRecipe={handleCreateCustomRecipe}
          onDeleteRecipe={handleDeleteCustomRecipe}
        />
        <AlertDialog
          open={clearPlanDialogOpen}
          onOpenChange={setClearPlanDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear the weekly plan?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove your current weekly plan and shopping cart.
                Your saved preferences will stay in place.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel render={<Button variant="outline" />}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                render={<Button variant="destructive" />}
                onClick={handleConfirmClearPlan}
              >
                Clear plan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Reset the app to default state?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will clear your fridge, pantry inventory, weekly plan, and
                grocery cart.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel render={<Button variant="outline" />}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                render={<Button variant="destructive" />}
                onClick={handleConfirmReset}
              >
                Reset app
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
