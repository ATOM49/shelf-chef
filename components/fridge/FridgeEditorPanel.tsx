"use client";

import type { AppAction } from "@/lib/appState";
import type { FridgeLayout } from "@/lib/fridge/types";
import { StorageEditorPanel } from "@/components/storage/StorageEditorPanel";

type FridgeEditorPanelProps = {
  layout: FridgeLayout;
  selectedShelfId?: string;
  dispatch: React.Dispatch<AppAction>;
  onClearSelection: () => void;
  showInlinePanel?: boolean;
};

export function FridgeEditorPanel({ layout, ...props }: FridgeEditorPanelProps) {
  return <StorageEditorPanel storage={layout} {...props} />;
}
