/**
 * POST /api/integrations/instamart/checkout
 *
 * Places the order for the current Swiggy Instamart cart via the `checkout`
 * MCP tool. This calls a production Swiggy endpoint and spends real money —
 * per the Instamart docs, it must only run after the user has explicitly
 * confirmed the cart total, items, and delivery address. The client is
 * expected to have shown that summary (via GET /api/integrations/instamart/cart)
 * before calling this route, and this route additionally requires an
 * explicit `confirm: true` in the body as a server-side backstop.
 *
 * Body: { addressId: string; paymentMethod?: string; confirm: true }
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { mcpErrorStatus } from "@/src/lib/mcp/invoke";
import { checkout } from "@/src/lib/instamart-mcp/client";

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  const body = (await request.json().catch(() => null)) as
    | { addressId?: string; paymentMethod?: string; confirm?: boolean }
    | null;

  const addressId = body?.addressId?.trim();

  if (!addressId) {
    return NextResponse.json({ error: "`addressId` is required." }, { status: 400 });
  }

  if (body?.confirm !== true) {
    return NextResponse.json(
      {
        error:
          "Order was not confirmed. Review the cart total, items, and delivery address, then resubmit with `confirm: true`.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await checkout(user.id, {
      addressId,
      paymentMethod: body?.paymentMethod,
    });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message ?? "Checkout failed." },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: mcpErrorStatus(message) });
  }
}
