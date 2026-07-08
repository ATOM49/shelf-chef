/**
 * GET /api/integrations/mcp/[provider]/status
 *
 * Lightweight connection-status check for client components that need to
 * decide whether to show a "Connect" or an authenticated action (e.g. the
 * grocery cart's "Order on Swiggy Instamart" button) without server-rendering
 * the whole page around `listConnections`.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { getEnabledMcpProvider } from "@/src/lib/mcp/providers";
import { getConnection } from "@/src/lib/mcp/token-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const user = await requireUser();
  const { provider: providerKey } = await params;

  if (!(await getEnabledMcpProvider(providerKey, user.id))) {
    return NextResponse.json(
      { error: `Unknown MCP provider: ${providerKey}` },
      { status: 404 },
    );
  }

  const connection = await getConnection(user.id, providerKey);
  const connected = !!connection && (!connection.expiresAt || connection.expiresAt > new Date());

  return NextResponse.json({
    provider: providerKey,
    connected,
    expiresAt: connection?.expiresAt?.toISOString() ?? null,
  });
}
