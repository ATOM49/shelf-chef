/**
 * OAuth 2.1-style helpers for MCP provider flows.
 *
 * Implements:
 *  - Authorization URL construction with PKCE + resource parameter
 *  - Authorization code → token exchange
 *  - Token refresh
 */

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

/**
 * Builds the authorization URL to redirect the user to the provider's
 * authorization endpoint.
 *
 * Always includes:
 *  - `response_type=code`
 *  - `code_challenge` / `code_challenge_method=S256`  (PKCE)
 *  - `resource`  (RFC 8707 – required by MCP)
 *  - Access tokens must never appear in query strings (MCP requirement) –
 *    this function only builds the *authorization* URL, not a token request.
 */
export function buildAuthorizationUrl(params: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  resourceUri: string;
}): string {
  const url = new URL(params.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scope);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", params.resourceUri);
  return url.toString();
}

/**
 * Exchanges an authorization code for an access token (and optional refresh
 * token) at the provider's token endpoint.
 *
 * Sends the `resource` parameter in the token request body as required by MCP.
 * Credentials are sent as HTTP Basic Auth (client_id:client_secret).
 */
export async function exchangeCodeForToken(params: {
  tokenEndpoint: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  resourceUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    resource: params.resourceUri,
  });

  const credentials = Buffer.from(
    `${params.clientId}:${params.clientSecret}`,
  ).toString("base64");

  const res = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${detail}`);
  }

  return res.json() as Promise<TokenResponse>;
}

/**
 * Refreshes an access token using a stored refresh token.
 *
 * Sends the `resource` parameter in the token request body as required by MCP.
 */
export async function refreshAccessToken(params: {
  tokenEndpoint: string;
  refreshToken: string;
  resourceUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    resource: params.resourceUri,
  });

  const credentials = Buffer.from(
    `${params.clientId}:${params.clientSecret}`,
  ).toString("base64");

  const res = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Token refresh failed (HTTP ${res.status}): ${detail}`);
  }

  return res.json() as Promise<TokenResponse>;
}
