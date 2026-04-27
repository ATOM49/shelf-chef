/**
 * GET /api/integrations/mcp/[provider]/callback
 *
 * Handles the OAuth 2.1 callback from an MCP provider's authorization server.
 *
 * Steps:
 *  1. Authenticate the current user.
 *  2. Validate the `state` parameter against the pending state.
 *  3. Exchange the authorization code for tokens (with PKCE verifier).
 *  4. Persist the connection in the token store.
 *  5. Redirect the user back to the application.
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { getMcpProvider, getClientId, getClientSecret } from "@/src/lib/mcp/providers";
import { discoverAuthorizationServerMetadata } from "@/src/lib/mcp/discovery";
import { exchangeCodeForToken } from "@/src/lib/mcp/oauth";
import { consumePendingState, upsertConnection } from "@/src/lib/mcp/token-store";

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

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Authorization server reported an error
  if (errorParam) {
    const description = searchParams.get("error_description") ?? errorParam;
    return NextResponse.redirect(
      `${request.nextUrl.origin}/?mcp_error=${encodeURIComponent(description)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter." },
      { status: 400 },
    );
  }

  // Validate state and retrieve the pending PKCE verifier
  const pending = consumePendingState(state);
  if (!pending) {
    return NextResponse.json(
      { error: "Invalid or expired state parameter." },
      { status: 400 },
    );
  }

  // Ensure the callback is for the same user who initiated the flow
  if (pending.userId !== user.id) {
    return NextResponse.json(
      { error: "State mismatch: user identity changed during OAuth flow." },
      { status: 400 },
    );
  }

  let clientId: string;
  let clientSecret: string;
  try {
    clientId = getClientId(providerKey);
    clientSecret = getClientSecret(providerKey);
  } catch {
    return NextResponse.json(
      { error: `Provider "${providerKey}" is not configured (missing client credentials).` },
      { status: 503 },
    );
  }

  // Discover token endpoint (re-fetch metadata; ideally cached in production)
  let tokenEndpoint: string;
  try {
    const issuerUrl = new URL("/.well-known/oauth-protected-resource", provider.mcpServerUrl);
    const prMeta = await fetch(issuerUrl.toString(), {
      headers: { Accept: "application/json" },
    });
    const prJson = (await prMeta.json()) as { authorization_servers?: string[] };
    const issuer = prJson.authorization_servers?.[0];
    if (!issuer) throw new Error("No authorization_servers in protected resource metadata");

    const asMeta = await discoverAuthorizationServerMetadata(issuer);
    tokenEndpoint = asMeta.token_endpoint;
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to discover token endpoint.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  let tokenResponse: Awaited<ReturnType<typeof exchangeCodeForToken>>;
  try {
    tokenResponse = await exchangeCodeForToken({
      tokenEndpoint,
      code,
      codeVerifier: pending.codeVerifier,
      redirectUri: pending.redirectUri,
      resourceUri: provider.mcpServerUrl,
      clientId,
      clientSecret,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Token exchange failed.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const expiresAt =
    tokenResponse.expires_in != null
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

  upsertConnection({
    userId: user.id,
    providerKey,
    providerType: "mcp",
    resourceUri: provider.mcpServerUrl,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
    scope: tokenResponse.scope,
    tokenType: tokenResponse.token_type,
  });

  // Redirect back to the app
  return NextResponse.redirect(`${request.nextUrl.origin}/?mcp_connected=${encodeURIComponent(providerKey)}`);
}
