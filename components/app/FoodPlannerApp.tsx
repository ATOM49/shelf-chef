"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StorageCanvas } from "@/components/storage/StorageCanvas";
import { StorageEditorPanel } from "@/components/storage/StorageEditorPanel";
import { GroceryCartPanel } from "@/components/planner/GroceryCartPanel";
import { PlannerSidebar } from "@/components/planner/PlannerSidebar";
import { InventoryListPanel } from "@/components/inventory/InventoryListPanel";
import { appReducer } from "@/lib/appState";
import type { StorageType } from "@/lib/fridge/types";
import { loadAppState, saveAppState } from "@/lib/persistence";
import { PRESET_METADATA, type PresetId } from "@/lib/inventory/presets";

type DesktopTab = "planner" | "inventory" | "cart";
type MobileTab = "storage" | "planner" | "inventory" | "cart";

export function FoodPlannerApp() {
  const [state, dispatch] = useReducer(appReducer, undefined, loadAppState);
  const [storageTab, setStorageTab] = useState<StorageType>("fridge");
  const [selectedShelfId, setSelectedShelfId] = useState<string | undefined>();
  const [selectedPantryShelfId, setSelectedPantryShelfId] = useState<string | undefined>();
  const [desktopTab, setDesktopTab] = useState<DesktopTab>("planner");
  const [mobileTab, setMobileTab] = useState<MobileTab>("storage");

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const handleSelectShelf = useCallback((shelfId: string) => {
    setSelectedShelfId(shelfId);
    setStorageTab("fridge");
    setMobileTab("storage");
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedShelfId(undefined);
  }, []);

  const handleSelectPantryShelf = useCallback((shelfId: string) => {
    setSelectedPantryShelfId(shelfId);
    setStorageTab("pantry");
    setMobileTab("storage");
  }, []);

  const handleClearPantrySelection = useCallback(() => {
    setSelectedPantryShelfId(undefined);
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

  const handleReset = () => {
    if (window.confirm("Reset the fridge, inventory, and weekly plan to defaults?")) {
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
          {/* Storage canvas — view-only for items; shelf drag/reorder and shelf editor still active */}
          <div className="hidden min-h-0 w-96 shrink-0 flex-col rounded-xl border bg-card p-3 md:flex">
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
                  inventory={state.inventory.filter((item) => item.storageId === state.fridge.id)}
                  selectedShelfId={selectedShelfId}
                  onSelectShelf={handleSelectShelf}
                  onReorderShelves={handleReorderFridgeShelves}
                />
              </TabsContent>
              <TabsContent value="pantry" className="mt-2 min-h-0 flex-1 overflow-y-auto">
                <StorageCanvas
                  layout={state.pantry}
                  inventory={state.inventory.filter((item) => item.storageId === state.pantry.id)}
                  selectedShelfId={selectedPantryShelfId}
                  onSelectShelf={handleSelectPantryShelf}
                  onReorderShelves={handleReorderPantryShelves}
                />
              </TabsContent>
            </Tabs>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Drag handles to reorder shelves. Click a shelf to edit its layout.
              </p>
              <div className="flex shrink-0 gap-2">
                <SeedInventoryMenu onSeed={(preset) => {
                  if (window.confirm(`Replace all inventory with the "${PRESET_METADATA[preset].label}" preset?`)) {
                    dispatch({ type: "SEED_INVENTORY", preset });
                  }
                }} />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => dispatch({ type: "ADD_SHELF", target: storageTab })}
                >
                  + Add Shelf
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 min-w-0 flex-1 rounded-xl border bg-card p-3 md:p-4">
            <div className="hidden h-full md:block">
              <Tabs value={desktopTab} onValueChange={(value) => setDesktopTab(value as DesktopTab)} className="h-full">
                <TabsList className="grid w-full max-w-lg grid-cols-3">
                  <TabsTrigger value="planner">Planner</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  <TabsTrigger value="cart">Shopping Cart</TabsTrigger>
                </TabsList>
                <TabsContent value="planner" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  <PlannerSidebar state={state} dispatch={dispatch} />
                </TabsContent>
                <TabsContent value="inventory" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  <InventoryListPanel
                    inventory={state.inventory}
                    fridge={state.fridge}
                    pantry={state.pantry}
                    dispatch={dispatch}
                  />
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="storage">Storage</TabsTrigger>
                  <TabsTrigger value="planner">Planner</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  <TabsTrigger value="cart">Cart</TabsTrigger>
                </TabsList>
                <TabsContent value="storage" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  <div className="flex flex-col gap-3">
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
                        inventory={state.inventory.filter((item) => item.storageId === state.fridge.id)}
                        selectedShelfId={selectedShelfId}
                        onSelectShelf={handleSelectShelf}
                        onReorderShelves={handleReorderFridgeShelves}
                      />
                    ) : (
                      <StorageCanvas
                        layout={state.pantry}
                        inventory={state.inventory.filter((item) => item.storageId === state.pantry.id)}
                        selectedShelfId={selectedPantryShelfId}
                        onSelectShelf={handleSelectPantryShelf}
                        onReorderShelves={handleReorderPantryShelves}
                      />
                    )}
                    <div className="flex gap-2">
                      <SeedInventoryMenu onSeed={(preset) => {
                        if (window.confirm(`Replace all inventory with the "${PRESET_METADATA[preset].label}" preset?`)) {
                          dispatch({ type: "SEED_INVENTORY", preset });
                        }
                      }} />
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => dispatch({ type: "ADD_SHELF", target: storageTab })}
                      >
                        + Add Shelf
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="planner" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  <PlannerSidebar state={state} dispatch={dispatch} />
                </TabsContent>
                <TabsContent value="inventory" className="mt-3 h-[calc(100%-2.5rem)] overflow-y-auto pr-1">
                  <InventoryListPanel
                    inventory={state.inventory}
                    fridge={state.fridge}
                    pantry={state.pantry}
                    dispatch={dispatch}
                  />
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
          selectedShelfId={selectedShelfId}
          dispatch={dispatch}
          onClearSelection={handleClearSelection}
          showInlinePanel={false}
        />
        <StorageEditorPanel
          storage={state.pantry}
          selectedShelfId={selectedPantryShelfId}
          dispatch={dispatch}
          onClearSelection={handleClearPantrySelection}
          showInlinePanel={false}
        />
      </div>
    </div>
  );
}

const PRESET_ORDER: PresetId[] = ["scarce", "fridge-heavy", "pantry-heavy", "well-stocked"];

function SeedInventoryMenu({ onSeed }: { onSeed: (preset: PresetId) => void }) {
  return (
    <Popover>
      <PopoverTrigger>
        <Button type="button" size="sm" variant="outline">
          Seed inventory
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Choose a preset
        </p>
        <div className="grid gap-1.5">
          {PRESET_ORDER.map((id) => {
            const meta = PRESET_METADATA[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSeed(id)}
                className="flex flex-col rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium">{meta.label}</span>
                <span className="text-xs text-muted-foreground">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
