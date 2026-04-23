"use client";

import type { GroceryCartItem } from "@/lib/planner/types";

type Props = {
  items: GroceryCartItem[];
  onToggle: (id: string) => void;
};

function formatQuantity(qty: number, unit: GroceryCartItem["unit"]): string {
  const rounded = Number.isInteger(qty) ? qty : qty.toFixed(1);
  return `${rounded} ${unit}`;
}

export function GroceryCartPanel({ items, onToggle }: Props) {
  if (items.length === 0) return null;

  const required = items.filter((i) => i.reason === "missing");
  const lowStock = items.filter((i) => i.reason === "low");

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Grocery cart</h3>
        <p className="text-xs text-muted-foreground">Check off items as you buy them — they&apos;ll be added to your pantry automatically.</p>
      </div>

      {required.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-destructive">Missing</div>
          {required.map((item) => (
            <GroceryRow key={item.id} item={item} onToggle={onToggle} />
          ))}
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Low stock top-ups
          </div>
          {lowStock.map((item) => (
            <GroceryRow key={item.id} item={item} onToggle={onToggle} />
          ))}
        </div>
      )}
    </section>
  );
}

function GroceryRow({ item, onToggle }: { item: GroceryCartItem; onToggle: (id: string) => void }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-card px-3 py-2 transition-opacity ${
        item.checked ? "opacity-50 line-through" : ""
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 accent-zinc-800"
        checked={item.checked}
        onChange={() => onToggle(item.id)}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">
          {item.displayName}{" "}
          <span className="font-normal text-muted-foreground">
            — {formatQuantity(item.neededQuantity, item.unit)}
          </span>
        </span>
        {item.recipeTitles.length > 0 && (
          <span className="text-xs text-muted-foreground">
            For: {item.recipeTitles.join(", ")}
          </span>
        )}
      </div>
    </label>
  );
}
