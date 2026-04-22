"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export const LOTTIE_ANIMATION_SOURCES = {
  planner: "/lottie/planner.lottie",
  stock: "/lottie/stock.lottie",
} as const;

const LOTTIE_CANVAS_SIZE = 200;

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
          "flex w-full max-w-md flex-col items-center gap-4 rounded-[min(var(--radius-3xl),28px)] border border-border/70 bg-card/95 px-6 py-6 text-center shadow-lg",
          panelClassName,
        )}
      >
        <div className="relative flex size-20 md:size-50 items-center justify-center overflow-hidden rounded-[min(var(--radius-2xl),24px)] bg-muted/40 ring-1 ring-border/60">
          <div className="pointer-events-none absolute inset-3 rounded-[min(var(--radius-xl),20px)] bg-linear-to-br from-background/70 via-background/30 to-secondary/20" />
          <DotLottieReact
            src={src}
            autoplay
            loop
            width={LOTTIE_CANVAS_SIZE}
            height={LOTTIE_CANVAS_SIZE}
            renderConfig={{ autoResize: false, devicePixelRatio: 1 }}
            className={cn("relative h-full w-full", animationClassName)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">{title}</p>
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
  );
}