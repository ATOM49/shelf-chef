"use client";

import type { ReactNode } from "react";

import { isInteractiveTarget } from "@/components/entities/card-interaction";
import {
  ITEM_STATUS_BADGE_CLASSES,
  ITEM_STATUS_LABELS,
  type ItemStatus,
} from "@/components/entities/item-status";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ItemCardProps = {
  name: string;
  emoji?: string;
  /** Preformatted quantity, e.g. "2 kg". */
  quantityLabel?: string;
  optional?: boolean;
  /** Secondary line under the name — availability detail, category, recipes… */
  detail?: ReactNode;
  /** Shows a tinted availability badge on the trailing edge. */
  status?: ItemStatus;
  /** Overrides the default label for `status`. */
  statusLabel?: string;
  /** Leading control, e.g. a Checkbox. */
  leading?: ReactNode;
  /** Extra trailing content, e.g. a tooltip trigger or action button. */
  trailing?: ReactNode;
  /** Dims the card (checked-off cart items). */
  muted?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

/**
 * Wide card-view of a stock item / ingredient / cart item — the standard way
 * an item appears in lists (recipe details, grocery cart, inventory pickers).
 */
export function ItemCard({
  name,
  emoji,
  quantityLabel,
  optional = false,
  detail,
  status,
  statusLabel,
  leading,
  trailing,
  muted = false,
  selected = false,
  onClick,
  className,
}: ItemCardProps) {
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(
        "flex-row items-center gap-3 px-3 py-2.5",
        interactive &&
          "cursor-pointer transition-shadow hover:ring-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-primary/5 ring-primary/40",
        muted && "opacity-60",
        className,
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? (event) => {
              if (isInteractiveTarget(event)) return;
              onClick?.();
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              if (isInteractiveTarget(event)) return;
              event.preventDefault();
              onClick?.();
            }
          : undefined
      }
    >
      {leading ? <div className="flex shrink-0 items-center">{leading}</div> : null}
      {emoji ? (
        <span className="shrink-0 text-base leading-none" aria-hidden>
          {emoji}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={cn(
              "text-sm font-medium text-foreground",
              muted && "line-through",
            )}
          >
            {name}
          </span>
          {quantityLabel ? (
            <span className="text-xs text-muted-foreground">{quantityLabel}</span>
          ) : null}
          {optional ? (
            <span className="text-xs text-muted-foreground italic">optional</span>
          ) : null}
        </div>
        {detail ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
        ) : null}
      </div>
      {status || trailing ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {status ? (
            <Badge variant="outline" className={ITEM_STATUS_BADGE_CLASSES[status]}>
              {statusLabel ?? ITEM_STATUS_LABELS[status]}
            </Badge>
          ) : null}
          {trailing}
        </div>
      ) : null}
    </Card>
  );
}
