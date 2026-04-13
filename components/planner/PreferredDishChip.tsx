"use client";

import type { PreferredDishRequest } from "@/lib/planner/types";

type Props = {
  dish: PreferredDishRequest;
  onRemove: (id: string) => void;
};

const STATUS_STYLES: Record<PreferredDishRequest["status"], string> = {
  pending: "bg-zinc-100 text-zinc-500",
  resolved: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<PreferredDishRequest["status"], string> = {
  pending: "Pending",
  resolved: "Found",
  failed: "Not found",
};

export function PreferredDishChip({ dish, onRemove }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm">
      <span className="font-medium text-zinc-800">{dish.name}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[dish.status]}`}
      >
        {STATUS_LABELS[dish.status]}
      </span>
      <button
        type="button"
        aria-label={`Remove ${dish.name}`}
        onClick={() => onRemove(dish.id)}
        className="ml-0.5 text-zinc-400 transition-colors hover:text-zinc-600"
      >
        ×
      </button>
    </div>
  );
}
