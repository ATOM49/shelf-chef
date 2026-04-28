/**
 * GET /api/integrations/mcp/[provider]/connect
 *
 * Starts the OAuth 2.1 + PKCE flow for connecting an MCP provider.
 *
 * Steps:
 *  1. Authenticate the current user (redirect to sign-in if missing).
 *  2. Look up the provider config from the registry.
 *  3. Discover the authorization server via OAuth metadata.
 *  4. Generate PKCE code verifier/challenge and a random state.
 *  5. Persist the pending state so the callback can verify it.
 *  6. Redirect the browser to the authorization endpoint.
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { getMcpProvider, getClientId } from "@/src/lib/mcp/providers";
import { discoverOAuthMetadata } from "@/src/lib/mcp/discovery";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "@/src/lib/mcp/pkce";
import { buildAuthorizationUrl } from "@/src/lib/mcp/oauth";
import { createPendingState } from "@/src/lib/mcp/token-store";

const PENDING_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const user = await requireUser();
  const { provider: providerKey } = await params;

  const provider = getMcpProvider(providerKey);
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown MCP provider: ${providerKey}` },
      { status: 404 },
    );
  }

  let clientId: string;
  try {
    clientId = getClientId(providerKey);
  } catch {
    return NextResponse.json(
      { error: `Provider "${providerKey}" is not configured (missing client credentials).` },
      { status: 503 },
    );
  }

  let authServerMeta: Awaited<ReturnType<typeof discoverOAuthMetadata>>["authServer"];
  try {
    const discovered = await discoverOAuthMetadata(provider.mcpServerUrl);
    authServerMeta = discovered.authServer;
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to discover OAuth metadata for provider.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/integrations/mcp/${providerKey}/callback`;

  const now = new Date();
  await createPendingState({
    userId: user.id,
    providerKey,
    codeVerifier,
    state,
    redirectUri,
    resourceUri: provider.mcpServerUrl,
    expiresAt: new Date(now.getTime() + PENDING_STATE_TTL_MS),
  });

  const authorizationUrl = buildAuthorizationUrl({
    authorizationEndpoint: authServerMeta.authorization_endpoint,
    clientId,
    redirectUri,
    scope: (provider.scopes ?? []).join(" "),
    state,
    codeChallenge,
    resourceUri: provider.mcpServerUrl,
  });

  return NextResponse.redirect(authorizationUrl);
}
