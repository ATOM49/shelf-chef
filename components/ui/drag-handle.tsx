"use client";

import { GripVertical } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type DragHandleProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  function DragHandle({ className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-xs transition-[background-color,border-color,box-shadow,color,opacity,transform] hover:border-muted-foreground/40 hover:bg-muted hover:text-foreground hover:shadow-sm active:cursor-grabbing active:translate-y-px focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
    );
  },
);
