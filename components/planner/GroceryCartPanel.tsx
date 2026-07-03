"use client";

import { CookingPot, Copy } from "lucide-react";

import { ItemCard } from "@/components/entities/ItemCard";
import { formatItemQuantity } from "@/components/entities/item-status";
import { RecipeBadge } from "@/components/entities/RecipeBadge";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GroceryCartItem } from "@/lib/planner/types";

type Props = {
  items: GroceryCartItem[];
  onToggle: (id: string) => void;
  onCopyMissing: () => void;
  onCopyLowStock: () => void;
  canUseClipboard: boolean;
};

export function GroceryCartPanel({
  items,
  onToggle,
  onCopyMissing,
  onCopyLowStock,
  canUseClipboard,
}: Props) {
  if (items.length === 0) return null;

  const required = items.filter((i) => i.reason === "missing");
  const lowStock = items.filter((i) => i.reason === "low");

  return (
    <TooltipProvider>
      <section className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Grocery cart</h3>
          <p className="text-xs text-muted-foreground">Check off items as you buy them — they&apos;ll be added to the Groceries shelf in your pantry.</p>
        </div>

        {required.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-destructive">
                Missing
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Copy missing items to clipboard"
                onClick={onCopyMissing}
                disabled={!canUseClipboard}
              >
                <Copy className="size-4" aria-hidden="true" />
              </Button>
            </div>
            {required.map((item) => (
              <GroceryRow key={item.id} item={item} onToggle={onToggle} />
            ))}
          </div>
        )}

        {lowStock.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Low stock top-ups
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Copy low stock items to clipboard"
                onClick={onCopyLowStock}
                disabled={!canUseClipboard}
              >
                <Copy className="size-4" aria-hidden="true" />
              </Button>
            </div>
            {lowStock.map((item) => (
              <GroceryRow key={item.id} item={item} onToggle={onToggle} />
            ))}
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}

function GroceryRow({ item, onToggle }: { item: GroceryCartItem; onToggle: (id: string) => void }) {
  return (
    <ItemCard
      name={item.displayName}
      quantityLabel={formatItemQuantity(item.neededQuantity, item.unit)}
      status={item.reason}
      muted={item.checked}
      onClick={() => onToggle(item.id)}
      leading={
        <Checkbox
          checked={item.checked}
          onCheckedChange={() => onToggle(item.id)}
          aria-label={`Mark ${item.displayName} as bought`}
        />
      }
      trailing={
        item.recipeTitles.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              className={cn(badgeVariants({ variant: "outline" }), "cursor-help")}
              aria-label={`Needed for ${item.recipeTitles.length} ${item.recipeTitles.length === 1 ? "recipe" : "recipes"}`}
            >
              <CookingPot aria-hidden />
              {item.recipeTitles.length}
            </TooltipTrigger>
            <TooltipContent className="flex-wrap justify-center gap-1.5">
              {item.recipeTitles.map((title) => (
                <RecipeBadge key={title} title={title} />
              ))}
            </TooltipContent>
          </Tooltip>
        ) : undefined
      }
    />
  );
}
