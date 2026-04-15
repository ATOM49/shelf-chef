"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorageCanvas } from "@/components/storage/StorageCanvas";
import { StorageEditorPanel } from "@/components/storage/StorageEditorPanel";
import { GroceryCartPanel } from "@/components/planner/GroceryCartPanel";
import { PlannerSidebar } from "@/components/planner/PlannerSidebar";
import { StockingDialog } from "@/components/stocking/StockingDialog";
import { appReducer } from "@/lib/appState";
import type { StockingItemDraft } from "@/lib/appState";
import type { StorageType } from "@/lib/fridge/types";
import { clearAppState, loadAppState, saveAppState } from "@/lib/persistence";

type DesktopTab = "planner" | "cart";
type MobileTab = "storage" | "planner" | "cart";

export function FoodPlannerApp() {
  const [state, dispatch] = useReducer(appReducer, undefined, loadAppState);
  const latestStateRef = useRef(state);
  const resetPendingRef = useRef(false);
  const [storageTab, setStorageTab] = useState<StorageType>("fridge");
  const [stockingOpen, setStockingOpen] = useState(false);
  const [selectedShelfId, setSelectedShelfId] = useState<string | undefined>();
  const [selectedCell, setSelectedCell] = useState<{ shelfId: string; cellId: string } | undefined>();
  const [selectedPantryShelfId, setSelectedPantryShelfId] = useState<string | undefined>();
  const [selectedPantryCell, setSelectedPantryCell] = useState<{ shelfId: string; cellId: string } | undefined>();
  const [desktopTab, setDesktopTab] = useState<DesktopTab>("planner");
  const [mobileTab, setMobileTab] = useState<MobileTab>("storage");
  const fridgeInventory = state.inventory.filter((item) => item.storageId === state.fridge.id);
  const pantryInventory = state.inventory.filter((item) => item.storageId === state.pantry.id);

  useLayoutEffect(() => {
    latestStateRef.current = state;
    saveAppState(state);
    resetPendingRef.current = false;
  }, [state]);

  useEffect(() => {
    const flushState = () => {
      if (resetPendingRef.current) {
        return;
      }

      saveAppState(latestStateRef.current);
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
  }, []);

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

  const handleSelectPantryCell = useCallback((shelfId: string, cellId: string) => {
    setSelectedPantryShelfId(shelfId);
    setSelectedPantryCell({ shelfId, cellId });
    setStorageTab("pantry");
    setMobileTab("storage");
  }, []);

  const handleClearPantrySelection = useCallback(() => {
    setSelectedPantryShelfId(undefined);
    setSelectedPantryCell(undefined);
  }, []);

  const handleReorderFridgeShelves = useCallback((activeShelfId: string, overShelfId: string) => {
    dispatch({
      type: "REORDER_SHELVES",
      target: "fridge",
      activeShelfId,
      overShelfId,
    });
  }, []);

  const handleReorderPantryShelves = useCallback((activeShelfId: string, overShelfId: string) => {
    dispatch({
      type: "REORDER_SHELVES",
      target: "pantry",
      activeShelfId,
      overShelfId,
    });
  }, []);

  const handleCommitStock = useCallback((items: StockingItemDraft[]) => {
    dispatch({ type: "STOCK_ITEMS", items });
  }, []);

  const handleReset = () => {
    if (window.confirm("Reset the fridge, inventory, and weekly plan to defaults?")) {
      resetPendingRef.current = true;
      clearAppState();
      dispatch({ type: "RESET_APP" });
      handleClearSelection();
      handleClearPantrySelection();
      setDesktopTab("planner");
      setMobileTab("storage");
    }
  };

  return (
    <div className="h-svh overflow-hidden bg-muted/30">
      <div className="mx-auto flex h-full max-w-screen-2xl flex-col p-3 md:p-4">
        <header className="shrink-0 rounded-xl border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍽️</span>
              <span className="text-lg font-semibold">ShelfChef</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleReset} className="shrink-0">
              Reset app
            </Button>
          </div>
        </header>

        <div className="mt-3 flex min-h-0 flex-1 gap-3">
          <div className="hidden min-h-0 w-96 shrink-0 flex-col rounded-xl border bg-card p-3 md:flex">
            <div className="mb-3 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={() => setStockingOpen(true)}
              >
                Stock items
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => dispatch({ type: "ADD_SHELF", target: storageTab })}
              >
                + Add Shelf
              </Button>
            </div>
            <Tabs
              value={storageTab}
              onValueChange={(v) => setStorageTab(v as StorageType)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="grid w-full grid-cols-2 shrink-0">
                <TabsTrigger value="fridge">🧊 Fridge</TabsTrigger>
                <TabsTrigger value="pantry">🗄️ Pantry</TabsTrigger>
              </TabsList>
              <TabsContent value="fridge" className="mt-2 min-h-0 flex-1 overflow-y-auto">
                <StorageCanvas
                  layout={state.fridge}
                  inventory={fridgeInventory}
                  selectedShelfId={selectedShelfId}
                  onSelectShelf={handleSelectShelf}
                  onSelectCell={handleSelectCell}
                  onReorderShelves={handleReorderFridgeShelves}
                />
              </TabsContent>
              <TabsContent value="pantry" className="mt-2 min-h-0 flex-1 overflow-y-auto">
                <StorageCanvas
                  layout={state.pantry}
                  inventory={pantryInventory}
                  selectedShelfId={selectedPantryShelfId}
                  onSelectShelf={handleSelectPantryShelf}
                  onSelectCell={handleSelectPantryCell}
                  onReorderShelves={handleReorderPantryShelves}
                />
              </TabsContent>
            </Tabs>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Drag shelf handles to reorder, or select a shelf or cell to edit.
              </p>
              <p className="text-xs text-muted-foreground">Use Stock items to let AI create shelves as needed.</p>
            </div>
          </div>

          <div className="min-h-0 min-w-0 flex-1 rounded-xl border bg-card p-3 md:p-4">
            <div className="hidden h-full md:block">
              <Tabs value={desktopTab} onValueChange={(value) => setDesktopTab(value as DesktopTab)} className="h-full">
                <TabsList className="grid w-full max-w-sm grid-cols-2">
                  <TabsTrigger value="planner">Planner</TabsTrigger>
                  <TabsTrigger value="cart">Shopping Cart</TabsTrigger>
                </TabsList>
                <TabsContent value="planner" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  <PlannerSidebar state={state} dispatch={dispatch} />
                </TabsContent>
                <TabsContent value="cart" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  {state.planner.groceryCart.length > 0 ? (
                    <GroceryCartPanel
                      items={state.planner.groceryCart}
                      onToggle={(id) => dispatch({ type: "TOGGLE_GROCERY_ITEM", itemId: id })}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Grocery cart is empty. Generate a weekly plan first.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="h-full md:hidden">
              <Tabs value={mobileTab} onValueChange={(value) => setMobileTab(value as MobileTab)} className="h-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="storage">Storage</TabsTrigger>
                  <TabsTrigger value="planner">Planner</TabsTrigger>
                  <TabsTrigger value="cart">Cart</TabsTrigger>
                </TabsList>
                <TabsContent value="storage" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => setStockingOpen(true)}
                      >
                        Stock items
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => dispatch({ type: "ADD_SHELF", target: storageTab })}
                      >
                        + Add Shelf
                      </Button>
                    </div>
                    <Tabs
                      value={storageTab}
                      onValueChange={(v) => setStorageTab(v as StorageType)}
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="fridge">🧊 Fridge</TabsTrigger>
                        <TabsTrigger value="pantry">🗄️ Pantry</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {storageTab === "fridge" ? (
                      <StorageCanvas
                        layout={state.fridge}
                        inventory={fridgeInventory}
                        selectedShelfId={selectedShelfId}
                        onSelectShelf={handleSelectShelf}
                        onSelectCell={handleSelectCell}
                        onReorderShelves={handleReorderFridgeShelves}
                      />
                    ) : (
                      <StorageCanvas
                        layout={state.pantry}
                        inventory={pantryInventory}
                        selectedShelfId={selectedPantryShelfId}
                        onSelectShelf={handleSelectPantryShelf}
                        onSelectCell={handleSelectPantryCell}
                        onReorderShelves={handleReorderPantryShelves}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      Stock items first to let AI build out fridge and pantry shelves for you.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="planner" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  <PlannerSidebar state={state} dispatch={dispatch} />
                </TabsContent>
                <TabsContent value="cart" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  {state.planner.groceryCart.length > 0 ? (
                    <GroceryCartPanel
                      items={state.planner.groceryCart}
                      onToggle={(id) => dispatch({ type: "TOGGLE_GROCERY_ITEM", itemId: id })}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Grocery cart is empty. Generate a weekly plan first.
                    </div>
                  )}
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
        />
      </div>
    </div>
  );
}
