"use client";

import type { AppAction } from "@/lib/appState";
import type { FridgeLayout } from "@/lib/fridge/types";
import type { InventoryItem } from "@/lib/inventory/types";
import { StorageEditorPanel } from "@/components/storage/StorageEditorPanel";

type FridgeEditorPanelProps = {
  layout: FridgeLayout;
  inventory: InventoryItem[];
  selectedShelfId?: string;
  selectedCell?: { shelfId: string; cellId: string };
  dispatch: React.Dispatch<AppAction>;
  onClearSelection: () => void;
  showInlinePanel?: boolean;
};

export function FridgeEditorPanel({ layout, ...props }: FridgeEditorPanelProps) {
  return <StorageEditorPanel storage={layout} {...props} />;
}
