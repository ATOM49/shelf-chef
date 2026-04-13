"use client";

import { useEffect, useId, useRef } from "react";
import { MealDetailsDrawer } from "@/components/planner/MealDetailsDrawer";
import { Button } from "@/components/ui/button";
import type { PlannedMeal } from "@/lib/planner/types";
import { X } from "lucide-react";

export function RecipeDetailPanel({
  meal,
  onClose,
}: {
  meal?: PlannedMeal;
  onClose: () => void;
}) {
  const isOpen = Boolean(meal);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusableElements = panel.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-200 md:duration-300 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close recipe details"
        className={`absolute inset-0 bg-background/60 transition-opacity duration-150 md:duration-200 ${
          isOpen ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        className={`pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-full transform flex-col border-l bg-background p-4 shadow-xl transition-transform duration-220 ease-out md:w-120 md:duration-320 lg:w-136 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 id={titleId} className="text-sm font-semibold text-foreground">Recipe details</h4>
          <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <MealDetailsDrawer meal={meal} />
        </div>
      </aside>
    </div>
  );
}
