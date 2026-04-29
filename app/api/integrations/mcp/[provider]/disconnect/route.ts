/**
 * POST /api/integrations/mcp/[provider]/disconnect
 *
 * Removes the stored OAuth connection for the current user and the given
 * MCP provider.
 *
 * Note: this does NOT revoke the access token at the authorization server.
 * To add server-side revocation, call the provider's revocation endpoint
 * (RFC 7009) before deleting the local record.
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { getMcpProvider } from "@/src/lib/mcp/providers";
import { deleteConnection } from "@/src/lib/mcp/token-store";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const user = await requireUser();
  const { provider: providerKey } = await params;

  if (!getMcpProvider(providerKey)) {
    return NextResponse.json(
      { error: `Unknown MCP provider: ${providerKey}` },
      { status: 404 },
    );
  }

  const deleted = await deleteConnection(user.id, providerKey);

  return NextResponse.json({
    disconnected: deleted,
    provider: providerKey,
  });
}
