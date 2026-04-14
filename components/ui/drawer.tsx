"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  side = "bottom",
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean
  side?: "bottom" | "right" | "left" | "top"
}) {
  const sideStyles: Record<string, string> = {
    bottom:
      "inset-x-0 bottom-0 rounded-t-xl translate-y-full data-open:translate-y-0 data-closed:translate-y-full max-h-[85svh]",
    right:
      "inset-y-0 right-0 w-full max-w-sm rounded-l-xl translate-x-full data-open:translate-x-0 data-closed:translate-x-full",
    left: "inset-y-0 left-0 w-full max-w-sm rounded-r-xl -translate-x-full data-open:translate-x-0 data-closed:-translate-x-full",
    top: "inset-x-0 top-0 rounded-b-xl -translate-y-full data-open:translate-y-0 data-closed:-translate-y-full max-h-[85svh]",
  }

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "fixed z-50 flex flex-col bg-background shadow-xl ring-1 ring-foreground/10 duration-200 ease-out outline-none overflow-hidden",
          sideStyles[side],
          className
        )}
        {...props}
      >
        {side === "bottom" && (
          <div className="mx-auto mt-3 mb-1 h-1 w-12 shrink-0 rounded-full bg-muted-foreground/20" />
        )}
        {children}
        {showCloseButton && (
          <DrawerPrimitive.Close
            data-slot="drawer-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DrawerPrimitive.Close>
        )}
      </DrawerPrimitive.Popup>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1 px-4 pt-2 pb-3", className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("flex flex-col gap-2 px-4 pb-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-heading text-base font-medium leading-none", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
