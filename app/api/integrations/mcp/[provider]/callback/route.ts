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
import { getEnabledMcpProvider, getClientId, getClientSecret } from "@/src/lib/mcp/providers";
import { discoverAuthorizationServerMetadata } from "@/src/lib/mcp/discovery";
import { exchangeCodeForToken } from "@/src/lib/mcp/oauth";
import { consumePendingState, upsertConnection } from "@/src/lib/mcp/token-store";

const DEFAULT_RETURN_TO = "/playground/mcp";

function buildRedirect(
  request: NextRequest,
  returnTo: string | undefined,
  query: Record<string, string>,
) {
  const redirectUrl = new URL(returnTo ?? DEFAULT_RETURN_TO, request.nextUrl.origin);

  for (const [key, value] of Object.entries(query)) {
    redirectUrl.searchParams.set(key, value);
  }

  return NextResponse.redirect(redirectUrl);
}

function buildErrorRedirect(
  request: NextRequest,
  providerKey: string,
  error: string,
  returnTo?: string,
) {
  return buildRedirect(request, returnTo, {
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

  const provider = await getEnabledMcpProvider(providerKey, user.id);
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

  // Consume the pending state as soon as we have one, so every error path
  // below can still redirect back to wherever the flow was started from
  // (e.g. the grocery cart) instead of always falling back to the playground.
  const pending = state ? await consumePendingState(state) : undefined;
  const returnTo = pending?.returnTo;

  // Authorization server reported an error
  if (errorParam) {
    const description = searchParams.get("error_description") ?? errorParam;
    return buildErrorRedirect(request, providerKey, description, returnTo);
  }

  if (!code || !state) {
    return buildErrorRedirect(
      request,
      providerKey,
      "Missing code or state parameter.",
      returnTo,
    );
  }

  if (!pending) {
    return buildErrorRedirect(
      request,
      providerKey,
      "Invalid or expired state parameter.",
      returnTo,
    );
  }

  // Ensure the callback is for the same user who initiated the flow
  if (pending.userId !== user.id) {
    return buildErrorRedirect(
      request,
      providerKey,
      "State mismatch: user identity changed during OAuth flow.",
      returnTo,
    );
  }

  let clientId: string;
  let clientSecret: string;
  try {
    clientId = getClientId(providerKey);
    clientSecret = getClientSecret(providerKey);
  } catch {
    return buildErrorRedirect(
      request,
      providerKey,
      `Provider "${providerKey}" is not configured (missing client credentials).`,
      returnTo,
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
    return buildErrorRedirect(
      request,
      providerKey,
      err instanceof Error
        ? `Failed to discover token endpoint: ${err.message}`
        : "Failed to discover token endpoint.",
      returnTo,
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
    return buildErrorRedirect(
      request,
      providerKey,
      err instanceof Error
        ? `Token exchange failed: ${err.message}`
        : "Token exchange failed.",
      returnTo,
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

  return buildRedirect(request, returnTo, {
    connected: providerKey,
  });
}
