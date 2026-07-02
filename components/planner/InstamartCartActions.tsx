"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { GroceryCartItem } from "@/lib/planner/types";
import { InstamartOrderDialog } from "@/components/planner/InstamartOrderDialog";

const SWIGGY_PROVIDER_KEY = "swiggy-instamart-mcp";

type Props = {
  items: GroceryCartItem[];
};

export function InstamartCartActions({ items }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/integrations/mcp/${SWIGGY_PROVIDER_KEY}/status`)
      .then((res) => (res.ok ? res.json() : { connected: false }))
      .then((data: { connected?: boolean }) => {
        if (!cancelled) setConnected(!!data.connected);
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (connected === null) return null;

  if (!connected) {
    return (
      <a
        href={`/api/integrations/mcp/${SWIGGY_PROVIDER_KEY}/connect?returnTo=/`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <ShoppingBag className="size-4" aria-hidden="true" />
        Connect Swiggy Instamart
      </a>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={items.length === 0}
      >
        <ShoppingBag className="size-4" aria-hidden="true" />
        Order on Swiggy Instamart
      </Button>
      <InstamartOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} items={items} />
    </>
  );
}
