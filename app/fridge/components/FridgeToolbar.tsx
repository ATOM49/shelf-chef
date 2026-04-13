"use client";

import React from "react";
import type { FridgeAction } from "../types";

type FridgeToolbarProps = {
  fridgeName: string;
  dispatch: React.Dispatch<FridgeAction>;
};

export function FridgeToolbar({ fridgeName, dispatch }: FridgeToolbarProps) {
  const handleReset = () => {
    if (confirm("Reset the fridge to default layout? This will erase all items.")) {
      dispatch({ type: "RESET" });
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xl">🧊</span>
        <span className="font-semibold text-zinc-800">{fridgeName}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400">Food Planner</span>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
