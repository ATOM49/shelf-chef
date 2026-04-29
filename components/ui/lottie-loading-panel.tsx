"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export const LOTTIE_ANIMATION_SOURCES = {
  planner: "/lottie/planner.lottie",
  stock: "/lottie/stock.lottie",
} as const;

type LottieLoadingPanelProps = {
  src: string;
  title: string;
  description: string;
  statusLabel?: string;
  className?: string;
  panelClassName?: string;
  animationClassName?: string;
};

export function LottieLoadingPanel({
  src,
  title,
  description,
  statusLabel = "Working",
  className,
  panelClassName,
  animationClassName,
}: LottieLoadingPanelProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      className={cn("flex h-full w-full items-center justify-center", className)}
    >
      <div
        className={cn(
          "relative min-h-72 w-full max-w-md overflow-hidden rounded-[min(var(--radius-3xl),28px)] border border-border/70 shadow-lg",
          panelClassName,
        )}
      >
        {/* Lottie animation sits on top section of the card */}
        <div className="relative h-56 w-full">
          <DotLottieReact
            src={src}
            autoplay
            loop
            renderConfig={{ autoResize: true, devicePixelRatio: 1 }}
            className={cn("h-full w-full", animationClassName)}
          />
        </div>

        {/* Text content is shown in a separate panel below the animation */}
        <div className="flex flex-col items-center justify-center gap-4 border-t border-border/60 bg-card/80 px-6 py-6 text-center supports-backdrop-filter:backdrop-blur-sm">
          <div className="space-y-2">
            <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-foreground" aria-hidden />
            <span>{statusLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}