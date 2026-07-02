/**
 * GET /api/integrations/instamart/addresses
 *
 * Lists the current user's saved Swiggy Instamart delivery addresses via the
 * `get_addresses` MCP tool. Requires an active swiggy-instamart-mcp
 * connection (connect via /api/integrations/mcp/swiggy-instamart-mcp/connect
 * first).
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { mcpErrorStatus } from "@/src/lib/mcp/invoke";
import { getAddresses } from "@/src/lib/instamart-mcp/client";

export async function GET(): Promise<NextResponse> {
  const user = await requireUser();

  try {
    const result = await getAddresses(user.id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message ?? "Failed to fetch addresses." },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: mcpErrorStatus(message) });
  }
}
