"use client";

import { useState } from "react";
import EmojiPickerReact, { Theme, type EmojiClickData } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type EmojiPickerProps = {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  disabled?: boolean;
};

export function EmojiPicker({ value, onValueChange, disabled = false }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onValueChange(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className="flex h-8 w-12 items-center justify-center rounded-md border border-transparent bg-background text-base shadow-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none"
      >
        <span aria-hidden>{value ?? "🙂"}</span>
        <span className="sr-only">Choose emoji</span>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
        <div className="flex items-center justify-end border-b px-2 py-1.5">
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              onValueChange(undefined);
              setOpen(false);
            }}
          >
            Clear
          </button>
        </div>
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          theme={Theme.AUTO}
          searchDisabled={false}
          skinTonesDisabled
          previewConfig={{ showPreview: false }}
        />
      </PopoverContent>
    </Popover>
  );
}
