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

function buildPlaygroundRedirect(
  request: NextRequest,
  query: Record<string, string>,
) {
  const redirectUrl = new URL("/playground/mcp", request.nextUrl.origin);

  for (const [key, value] of Object.entries(query)) {
    redirectUrl.searchParams.set(key, value);
  }

  return NextResponse.redirect(redirectUrl);
}

function buildPlaygroundErrorRedirect(
  request: NextRequest,
  providerKey: string,
  error: string,
) {
  return buildPlaygroundRedirect(request, {
    error,
    provider: providerKey,
  });
}

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
    return buildPlaygroundErrorRedirect(request, providerKey, description);
  }

  if (!code || !state) {
    return buildPlaygroundErrorRedirect(
      request,
      providerKey,
      "Missing code or state parameter.",
    );
  }

  // Validate state and retrieve the pending PKCE verifier
  const pending = await consumePendingState(state);
  if (!pending) {
    return buildPlaygroundErrorRedirect(
      request,
      providerKey,
      "Invalid or expired state parameter.",
    );
  }

  // Ensure the callback is for the same user who initiated the flow
  if (pending.userId !== user.id) {
    return buildPlaygroundErrorRedirect(
      request,
      providerKey,
      "State mismatch: user identity changed during OAuth flow.",
    );
  }

  let clientId: string;
  let clientSecret: string;
  try {
    clientId = getClientId(providerKey);
    clientSecret = getClientSecret(providerKey);
  } catch {
    return buildPlaygroundErrorRedirect(
      request,
      providerKey,
      `Provider "${providerKey}" is not configured (missing client credentials).`,
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
    return buildPlaygroundErrorRedirect(
      request,
      providerKey,
      err instanceof Error
        ? `Failed to discover token endpoint: ${err.message}`
        : "Failed to discover token endpoint.",
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
    return buildPlaygroundErrorRedirect(
      request,
      providerKey,
      err instanceof Error
        ? `Token exchange failed: ${err.message}`
        : "Token exchange failed.",
    );
  }

  const expiresAt =
    tokenResponse.expires_in != null
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

  await upsertConnection({
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

  return buildPlaygroundRedirect(request, {
    connected: providerKey,
  });
}
