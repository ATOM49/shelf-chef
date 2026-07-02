/**
 * POST /api/integrations/instamart/search
 *
 * Searches Swiggy Instamart products for a delivery address via the
 * `search_products` MCP tool, so the client can let the user pick the exact
 * variant to add to cart for a grocery cart item (per the Instamart docs,
 * the agent must never guess a variant on the user's behalf).
 *
 * Body: { addressId: string; query: string; offset?: number }
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { mcpErrorStatus } from "@/src/lib/mcp/invoke";
import { searchProducts } from "@/src/lib/instamart-mcp/client";

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  const body = (await request.json().catch(() => null)) as
    | { addressId?: string; query?: string; offset?: number }
    | null;

  const addressId = body?.addressId?.trim();
  const query = body?.query?.trim();

  if (!addressId || !query) {
    return NextResponse.json(
      { error: "Both `addressId` and `query` are required." },
      { status: 400 },
    );
  }

  try {
    const result = await searchProducts(user.id, {
      addressId,
      query,
      offset: body?.offset,
    });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message ?? "Product search failed." },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: mcpErrorStatus(message) });
  }
}
