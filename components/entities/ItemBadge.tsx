"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ITEM_STATUS_BADGE_CLASSES,
  ITEM_STATUS_LABELS,
  type ItemStatus,
} from "@/components/entities/item-status";

type ItemBadgeProps = {
  name: string;
  emoji?: string;
  /** Preformatted quantity, e.g. "2 kg". */
  quantityLabel?: string;
  /** Tints the badge by availability when provided. */
  status?: ItemStatus;
  className?: string;
};

/**
 * Badge-view of a stock item / ingredient / cart item. Used wherever an item
 * is referenced inline (missing-item lists, tooltips, chips).
 */
export function ItemBadge({
  name,
  emoji,
  quantityLabel,
  status,
  className,
}: ItemBadgeProps) {
  const title = status
    ? `${name} · ${ITEM_STATUS_LABELS[status]}`
    : name;

  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full",
        status ? ITEM_STATUS_BADGE_CLASSES[status] : undefined,
        className,
      )}
      title={title}
    >
      {emoji ? <span aria-hidden>{emoji}</span> : null}
      <span className="truncate">{name}</span>
      {quantityLabel ? (
        <span className="font-normal opacity-75">{quantityLabel}</span>
      ) : null}
    </Badge>
  );
}
