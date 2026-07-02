/**
 * /api/integrations/instamart/cart
 *
 * GET    — reads the current Instamart cart (bill breakdown + available
 *          payment methods) via `get_cart`.
 * POST   — adds/updates items in the Instamart cart via `update_cart`, then
 *          returns the refreshed `get_cart` result.
 *          Body: { addressId: string; items: { spinId: string; quantity: number }[] }
 * DELETE — empties the Instamart cart via `clear_cart`. Used before starting
 *          a fresh order or switching delivery address.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { mcpErrorStatus } from "@/src/lib/mcp/invoke";
import { clearCart, getCart, updateCart } from "@/src/lib/instamart-mcp/client";

export async function GET(): Promise<NextResponse> {
  const user = await requireUser();

  try {
    const result = await getCart(user.id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message ?? "Failed to fetch cart." },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: mcpErrorStatus(message) });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  const body = (await request.json().catch(() => null)) as
    | { addressId?: string; items?: Array<{ spinId?: string; quantity?: number }> }
    | null;

  const addressId = body?.addressId?.trim();
  const items = body?.items;

  if (!addressId || !items || items.length === 0) {
    return NextResponse.json(
      { error: "`addressId` and a non-empty `items` array are required." },
      { status: 400 },
    );
  }

  const normalizedItems = items.map((item) => ({
    spinId: item.spinId ?? "",
    quantity: item.quantity ?? 1,
  }));

  if (normalizedItems.some((item) => !item.spinId || item.quantity < 1)) {
    return NextResponse.json(
      { error: "Every item requires a `spinId` and a quantity of at least 1." },
      { status: 400 },
    );
  }

  try {
    const updateResult = await updateCart(user.id, {
      selectedAddressId: addressId,
      items: normalizedItems,
    });
    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error?.message ?? "Failed to update cart." },
        { status: 502 },
      );
    }

    const cartResult = await getCart(user.id);
    return NextResponse.json({ success: true, data: cartResult.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: mcpErrorStatus(message) });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const user = await requireUser();

  try {
    const result = await clearCart(user.id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message ?? "Failed to clear cart." },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: mcpErrorStatus(message) });
  }
}
