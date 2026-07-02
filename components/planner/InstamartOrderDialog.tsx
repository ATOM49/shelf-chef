"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { GroceryCartItem } from "@/lib/planner/types";
import { findObjectsWithKey, pickFirstArray, pickString } from "@/src/lib/instamart-mcp/json-utils";

type Step = "addresses" | "items" | "review" | "placed";

type ItemSelection =
  | { status: "pending" }
  | { status: "skipped" }
  | { status: "selected"; spinId: string; label: string; quantity: number };

type InstamartOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: GroceryCartItem[];
};

type ApiEnvelope = { error?: string; data?: unknown };

async function readJson(response: Response): Promise<{ ok: boolean; body: ApiEnvelope | null }> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope | null;
  return { ok: response.ok, body };
}

function candidateLabel(candidate: Record<string, unknown>, fallback: string): string {
  const name = pickString(candidate, [
    "name",
    "productName",
    "displayName",
    "title",
    "label",
    "address",
    "formattedAddress",
    "addressLine1",
    "line1",
  ]);
  const detail = pickString(candidate, ["quantity", "weight", "pack", "variant", "city", "annotation"]);
  const price = pickString(candidate, ["price", "sellingPrice", "finalPrice", "mrp"]);
  const parts = [name ?? fallback, detail].filter(Boolean);
  const label = parts.join(" — ");
  return price ? `${label} (₹${price})` : label;
}

export function InstamartOrderDialog({ open, onOpenChange, items }: InstamartOrderDialogProps) {
  const [step, setStep] = useState<Step>("addresses");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addressCandidates, setAddressCandidates] = useState<Record<string, unknown>[]>([]);
  const [addressesRaw, setAddressesRaw] = useState<unknown>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const [itemIndex, setItemIndex] = useState(0);
  const [searchResultsByItem, setSearchResultsByItem] = useState<
    Record<string, Record<string, unknown>[]>
  >({});
  const [searchingItem, setSearchingItem] = useState(false);
  const [selections, setSelections] = useState<Record<string, ItemSelection>>({});

  const [cartData, setCartData] = useState<unknown>(null);
  const [placing, setPlacing] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [orderResult, setOrderResult] = useState<unknown>(null);

  const currentItem = items[itemIndex] as GroceryCartItem | undefined;

  async function loadAddresses() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/instamart/addresses");
      const { ok, body } = await readJson(res);
      if (!ok) throw new Error(body?.error ?? "Failed to load addresses.");
      setAddressesRaw(body?.data ?? null);
      const candidates = findObjectsWithKey(body?.data, ["id", "addressId"]);
      setAddressCandidates(candidates);
      if (candidates.length === 1) {
        const id = pickString(candidates[0], ["id", "addressId"]);
        if (id) setSelectedAddressId(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load addresses.");
    } finally {
      setLoading(false);
    }
  }

  async function searchCurrentItem() {
    if (!currentItem || !selectedAddressId) return;
    if (searchResultsByItem[currentItem.id]) return;

    setSearchingItem(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/instamart/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId: selectedAddressId, query: currentItem.displayName }),
      });
      const { ok, body } = await readJson(res);
      if (!ok) throw new Error(body?.error ?? "Product search failed.");
      const candidates = findObjectsWithKey(body?.data, ["spinId"]);
      setSearchResultsByItem((current) => ({ ...current, [currentItem.id]: candidates }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product search failed.");
    } finally {
      setSearchingItem(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setStep("addresses");
      setError(null);
      setAddressCandidates([]);
      setAddressesRaw(null);
      setSelectedAddressId(null);
      setItemIndex(0);
      setSearchResultsByItem({});
      setSelections({});
      setCartData(null);
      setConfirmChecked(false);
      setOrderResult(null);
      void loadAddresses();
    });
  }, [open]);

  useEffect(() => {
    if (step !== "items") return;
    queueMicrotask(() => void searchCurrentItem());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, itemIndex, selectedAddressId]);

  function selectVariant(candidate: Record<string, unknown>) {
    if (!currentItem) return;
    const spinId = pickString(candidate, ["spinId"]);
    if (!spinId) return;
    setSelections((current) => ({
      ...current,
      [currentItem.id]: {
        status: "selected",
        spinId,
        label: candidateLabel(candidate, currentItem.displayName),
        quantity: 1,
      },
    }));
  }

  function skipCurrentItem() {
    if (!currentItem) return;
    setSelections((current) => ({ ...current, [currentItem.id]: { status: "skipped" } }));
  }

  function goToNextItem() {
    if (itemIndex + 1 < items.length) {
      setItemIndex((i) => i + 1);
    } else {
      void proceedToReview();
    }
  }

  async function proceedToReview() {
    if (!selectedAddressId) return;
    const matched = Object.values(selections).filter(
      (s): s is Extract<ItemSelection, { status: "selected" }> => s.status === "selected",
    );

    setLoading(true);
    setError(null);
    try {
      if (matched.length > 0) {
        const res = await fetch("/api/integrations/instamart/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addressId: selectedAddressId,
            items: matched.map((m) => ({ spinId: m.spinId, quantity: m.quantity })),
          }),
        });
        const { ok, body } = await readJson(res);
        if (!ok) throw new Error(body?.error ?? "Failed to update Instamart cart.");
        setCartData(body?.data ?? null);
      } else {
        const res = await fetch("/api/integrations/instamart/cart");
        const { ok, body } = await readJson(res);
        if (ok) setCartData(body?.data ?? null);
      }
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update Instamart cart.");
    } finally {
      setLoading(false);
    }
  }

  async function placeOrder() {
    if (!selectedAddressId || !confirmChecked) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/instamart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId: selectedAddressId, confirm: true }),
      });
      const { ok, body } = await readJson(res);
      if (!ok) throw new Error(body?.error ?? "Checkout failed.");
      setOrderResult(body?.data ?? null);
      setStep("placed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setPlacing(false);
    }
  }

  const matchedCount = useMemo(
    () => Object.values(selections).filter((s) => s.status === "selected").length,
    [selections],
  );
  const skippedCount = useMemo(
    () => Object.values(selections).filter((s) => s.status === "skipped").length,
    [selections],
  );

  const cartTotal = pickString(cartData as Record<string, unknown>, [
    "total",
    "grandTotal",
    "payableAmount",
    "finalAmount",
    "cartTotal",
    "billTotal",
  ]);
  const paymentMethods = pickFirstArray(cartData, ["availablePaymentMethods", "paymentMethods"]);
  const orderId = pickString(orderResult as Record<string, unknown>, ["orderId", "id", "orderNumber"]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Order on Swiggy Instamart</DialogTitle>
          <DialogDescription>
            {step === "addresses" && "Pick a delivery address."}
            {step === "items" &&
              `Item ${itemIndex + 1} of ${items.length} — pick the exact product variant, or skip it.`}
            {step === "review" && "Review the Instamart cart before placing the order."}
            {step === "placed" && "Order placed."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "addresses" && (
          <div className="flex flex-col gap-2">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading addresses…
              </div>
            )}
            {!loading && addressCandidates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No saved addresses were found. Add a delivery address in the Swiggy Instamart app,
                then reopen this dialog.
              </p>
            )}
            {addressCandidates.map((candidate, i) => {
              const id = pickString(candidate, ["id", "addressId"]);
              if (!id) return null;
              return (
                <label
                  key={id ?? i}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-card px-3 py-2 ${
                    selectedAddressId === id ? "border-foreground" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="instamart-address"
                    className="mt-0.5 accent-zinc-800"
                    checked={selectedAddressId === id}
                    onChange={() => setSelectedAddressId(id)}
                  />
                  <span className="text-sm text-foreground">{candidateLabel(candidate, "Address")}</span>
                </label>
              );
            })}
            {addressCandidates.length === 0 && !loading && addressesRaw != null && (
              <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-2 text-xs">
                {JSON.stringify(addressesRaw, null, 2)}
              </pre>
            )}
          </div>
        )}

        {step === "items" && currentItem && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{currentItem.displayName}</span>
              {selections[currentItem.id]?.status === "selected" && (
                <Badge variant="outline">Selected</Badge>
              )}
              {selections[currentItem.id]?.status === "skipped" && (
                <Badge variant="outline">Skipped</Badge>
              )}
            </div>
            {searchingItem && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Searching Instamart…
              </div>
            )}
            {!searchingItem && (searchResultsByItem[currentItem.id]?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                No matching products found. Skip this item and add it manually in the Instamart app if
                needed.
              </p>
            )}
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {(searchResultsByItem[currentItem.id] ?? []).map((candidate, i) => {
                const spinId = pickString(candidate, ["spinId"]);
                const selection = selections[currentItem.id];
                const isSelected = selection?.status === "selected" && selection.spinId === spinId;
                return (
                  <label
                    key={spinId ?? i}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-card px-3 py-2 ${
                      isSelected ? "border-foreground" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name={`instamart-variant-${currentItem.id}`}
                      className="mt-0.5 accent-zinc-800"
                      checked={isSelected}
                      onChange={() => selectVariant(candidate)}
                    />
                    <span className="text-sm text-foreground">
                      {candidateLabel(candidate, currentItem.displayName)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-muted-foreground">
              {matchedCount} item{matchedCount === 1 ? "" : "s"} added to the Instamart cart
              {skippedCount > 0 ? `, ${skippedCount} skipped` : ""}.
            </div>
            {cartTotal && (
              <div className="text-sm font-medium text-foreground">Estimated total: ₹{cartTotal}</div>
            )}
            {paymentMethods && paymentMethods.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Payment: default available method will be used (see raw cart below to verify).
              </div>
            )}
            <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/30 p-2 text-xs">
              {JSON.stringify(cartData, null, 2)}
            </pre>
            <Separator />
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 accent-zinc-800"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
              />
              I&apos;ve reviewed the address, items, and total above and want to place this order on
              Swiggy Instamart.
            </label>
          </div>
        )}

        {step === "placed" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <PackageCheck className="size-8 text-emerald-600" />
            <p className="text-sm text-foreground">
              Order placed{orderId ? ` — ${orderId}` : ""}. Track it in the Swiggy Instamart app.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "addresses" && (
            <Button
              type="button"
              onClick={() => setStep("items")}
              disabled={!selectedAddressId || items.length === 0}
            >
              Continue
            </Button>
          )}
          {step === "items" && (
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setItemIndex((i) => Math.max(0, i - 1))}
                disabled={itemIndex === 0}
                aria-label="Previous item"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={skipCurrentItem}>
                  Skip
                </Button>
                <Button type="button" onClick={goToNextItem} disabled={loading}>
                  {itemIndex + 1 < items.length ? (
                    <>
                      Next <ChevronRight className="size-4" />
                    </>
                  ) : (
                    "Review cart"
                  )}
                </Button>
              </div>
            </div>
          )}
          {step === "review" && (
            <Button type="button" onClick={() => void placeOrder()} disabled={!confirmChecked || placing}>
              {placing ? "Placing order…" : "Place order"}
            </Button>
          )}
          {step === "placed" && (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
