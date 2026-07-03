import type { KeyboardEvent, MouseEvent } from "react";

/**
 * True when the event originated inside an interactive child (button, link,
 * input…). Card-level click handlers ignore those so nested controls — a
 * checkbox, a swap button, a tooltip trigger — keep working without every
 * caller having to stopPropagation.
 */
export function isInteractiveTarget(
  event: MouseEvent | KeyboardEvent,
): boolean {
  const interactive = (event.target as HTMLElement).closest(
    // Base UI renders some controls as spans with ARIA roles (e.g. Checkbox
    // is a span[role=checkbox]), so match roles as well as native tags.
    "button, a, input, select, textarea, label, [role=button], [role=checkbox], [role=switch], [role=menuitem]",
  );
  // The card itself is a [role=button]; only clicks on controls nested
  // inside it should be excluded.
  return Boolean(interactive && interactive !== event.currentTarget);
}
