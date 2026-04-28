"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { DEFAULT_STAPLE_DISPLAY_NAMES } from "@/lib/inventory/staples";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
    <div className="flex flex-col gap-4 overflow-y-auto">
      <p className="text-xs text-muted-foreground">
        Staples are assumed to always be in your kitchen — they won&apos;t be
        flagged as missing in recipes or added to your grocery cart.
      </p>

      {/* Built-in staples */}
      <div className="grid gap-2">
        <h4 className="text-sm font-semibold text-foreground">Built-in staples</h4>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_STAPLE_DISPLAY_NAMES.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600"
            >
              {name}
            </span>
          ))}
          <span
            className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600"
            title="And more common forms — e.g. table salt, olive oil, black pepper…"
          >
            + more variants…
          </span>
        </div>
      </div>

      {/* Custom staples */}
      <div className="grid gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          Your custom staples
          {customStapleNames.length > 0 ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({customStapleNames.length})
            </span>
          ) : null}
        </h4>
        {customStapleNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {customStapleNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 pl-2.5 pr-1.5 py-0.5 text-xs font-medium text-blue-700"
              >
                {name}
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemoveStaple(name)}
                  className="inline-flex items-center justify-center rounded-full text-blue-500 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <XIcon className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No custom staples yet — add your own below!
          </p>
        )}
      </div>

      {/* Add new */}
      <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
        <Label htmlFor="staples-input" className="text-sm font-medium">
          Add more staples
        </Label>
        <Textarea
          id="staples-input"
          rows={3}
          placeholder="Turmeric&#10;Cumin seeds, Mustard seeds&#10;Garlic"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Enter one ingredient per line, or separate with commas.
        </p>
        <Button
          type="button"
          disabled={!inputText.trim()}
          onClick={handleAdd}
          className="w-fit"
        >
          Add staples
        </Button>
      </div>
    </div>
  );
}
