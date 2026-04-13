"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { FridgeCanvas } from "@/components/fridge/FridgeCanvas";
import { FridgeEditorPanel } from "@/components/fridge/FridgeEditorPanel";
import { PlannerSidebar } from "@/components/planner/PlannerSidebar";
import { appReducer } from "@/lib/appState";
import { loadAppState, saveAppState } from "@/lib/persistence";

type SidebarTab = "fridge" | "planner";

export function FoodPlannerApp() {
  const [state, dispatch] = useReducer(appReducer, undefined, loadAppState);
  const [selectedShelfId, setSelectedShelfId] = useState<string | undefined>();
  const [selectedCell, setSelectedCell] = useState<{ shelfId: string; cellId: string } | undefined>();
  const [activeTab, setActiveTab] = useState<SidebarTab>("fridge");

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const handleSelectShelf = useCallback((shelfId: string) => {
    setSelectedShelfId(shelfId);
    setSelectedCell(undefined);
    setActiveTab("fridge");
  }, []);

  const handleSelectCell = useCallback((shelfId: string, cellId: string) => {
    setSelectedShelfId(shelfId);
    setSelectedCell({ shelfId, cellId });
    setActiveTab("fridge");
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedShelfId(undefined);
    setSelectedCell(undefined);
  }, []);

  const handleReset = () => {
    if (window.confirm("Reset the fridge, inventory, and weekly plan to defaults?")) {
      dispatch({ type: "RESET_APP" });
      handleClearSelection();
      setActiveTab("fridge");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧊</span>
            <div>
              <div className="font-semibold text-zinc-800">{state.fridge.name}</div>
              <div className="text-xs text-zinc-400">Inventory + meal planning MVP</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
          >
            Reset app
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="flex flex-col gap-3">
            <FridgeCanvas
              layout={state.fridge}
              inventory={state.inventory}
              selectedShelfId={selectedShelfId}
              onSelectShelf={handleSelectShelf}
              onSelectCell={handleSelectCell}
            />
            <p className="text-center text-xs text-zinc-400">
              Click shelves and cells to manage storage layout and per-cell inventory.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
              {(["fridge", "planner"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "fridge" ? (
              <FridgeEditorPanel
                layout={state.fridge}
                inventory={state.inventory}
                selectedShelfId={selectedShelfId}
                selectedCell={selectedCell}
                dispatch={dispatch}
                onClearSelection={handleClearSelection}
              />
            ) : (
              <PlannerSidebar state={state} dispatch={dispatch} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
