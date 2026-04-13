"use client";

import React, { useReducer, useState, useEffect, useCallback } from "react";
import { fridgeReducer, createDefaultSingleDoorFridge } from "../fridgeStore";
import type { FridgeLayout } from "../types";
import { FridgeCanvas } from "./FridgeCanvas";
import { FridgeInspector } from "./FridgeInspector";
import { FridgeToolbar } from "./FridgeToolbar";

const STORAGE_KEY = "food-planner-fridge-layout";

function loadFromStorage(): FridgeLayout | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as FridgeLayout;
  } catch {
    // ignore
  }
  return undefined;
}

function saveToStorage(layout: FridgeLayout) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

export function FridgeInventoryPage() {
  const [layout, dispatch] = useReducer(
    fridgeReducer,
    undefined,
    () => loadFromStorage() ?? createDefaultSingleDoorFridge()
  );

  const [selectedShelfId, setSelectedShelfId] = useState<string | undefined>();
  const [selectedCell, setSelectedCell] = useState<
    { shelfId: string; cellId: string } | undefined
  >();

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(layout);
  }, [layout]);

  const handleSelectShelf = useCallback((shelfId: string) => {
    setSelectedShelfId(shelfId);
    setSelectedCell(undefined);
  }, []);

  const handleSelectCell = useCallback((shelfId: string, cellId: string) => {
    setSelectedShelfId(shelfId);
    setSelectedCell({ shelfId, cellId });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedShelfId(undefined);
    setSelectedCell(undefined);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-4">
        <FridgeToolbar fridgeName={layout.name} dispatch={dispatch} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[420px_1fr]">
          {/* Fridge canvas */}
          <div className="flex flex-col gap-3">
            <FridgeCanvas
              layout={layout}
              selectedShelfId={selectedShelfId}
              onSelectShelf={handleSelectShelf}
              onSelectCell={handleSelectCell}
            />
            <p className="text-center text-xs text-zinc-400">
              Click a shelf to select it, then click a cell to add items
            </p>
          </div>

          {/* Inspector panel */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm h-fit">
            <FridgeInspector
              layout={layout}
              selectedShelfId={selectedShelfId}
              selectedCell={selectedCell}
              dispatch={dispatch}
              onClearSelection={handleClearSelection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
