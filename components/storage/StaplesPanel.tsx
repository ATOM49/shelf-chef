"use client";

import { useState } from "react";
import { Plus, XIcon } from "lucide-react";
import { DEFAULT_STAPLE_DISPLAY_NAMES } from "@/lib/inventory/staples";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type StaplesPanelProps = {
  customStapleNames: string[];
  onAddStaples: (names: string[]) => void;
  onRemoveStaple: (name: string) => void;
};

export function StaplesPanel({
  customStapleNames,
  onAddStaples,
  onRemoveStaple,
}: StaplesPanelProps) {
  const [inputText, setInputText] = useState("");

  const handleAdd = () => {
    const names = inputText
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    onAddStaples(names);
    setInputText("");
  };

  return (
    <div className="flex flex-col gap-5 overflow-y-auto">
      <p className="text-xs text-muted-foreground">
        Always assumed in stock — never flagged as missing or added to your cart.
      </p>

      {/* Add new */}
      <div className="flex items-start gap-2">
        <Textarea
          id="staples-input"
          rows={1}
          placeholder="Add a staple — turmeric, cumin, garlic…"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="min-h-9 flex-1 resize-none py-2 text-sm"
        />
        <Button
          type="button"
          size="icon"
          aria-label="Add staples"
          disabled={!inputText.trim()}
          onClick={handleAdd}
          className="shrink-0"
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>

      {/* Custom staples */}
      {customStapleNames.length > 0 ? (
        <div className="grid gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Yours · {customStapleNames.length}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {customStapleNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-foreground"
              >
                {name}
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemoveStaple(name)}
                  className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <XIcon className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Built-in staples */}
      <div className="grid gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Built-in
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_STAPLE_DISPLAY_NAMES.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              {name}
            </span>
          ))}
          <span
            className="inline-flex items-center rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground"
            title="And more common forms — e.g. table salt, olive oil, black pepper…"
          >
            +more
          </span>
        </div>
      </div>
    </div>
  );
}
