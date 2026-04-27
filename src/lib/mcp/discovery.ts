/**
 * OAuth 2.0 metadata discovery helpers.
 *
 * MCP servers use two well-known endpoints to advertise their OAuth
 * requirements:
 *
 *  1. Protected Resource Metadata  (RFC 9470 / draft-ietf-oauth-resource-metadata)
 *     GET {resource}/.well-known/oauth-protected-resource
 *     → lists the authorization servers that issue tokens for this resource
 *
 *  2. Authorization Server Metadata  (RFC 8414)
 *     GET {issuer}/.well-known/oauth-authorization-server
 *     → lists endpoints (authorization, token, …) and supported features
 */

export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  [key: string]: unknown;
};

export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  response_types_supported: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
  [key: string]: unknown;
};

/**
 * Fetches the Protected Resource Metadata document for an MCP server.
 *
 * @param resourceUrl - Base URL of the MCP server (canonical resource URI).
 */
export async function discoverProtectedResourceMetadata(
  resourceUrl: string,
): Promise<ProtectedResourceMetadata> {
  const url = new URL("/.well-known/oauth-protected-resource", resourceUrl);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `Protected resource metadata fetch failed for ${resourceUrl}: HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<ProtectedResourceMetadata>;
}

/**
 * Fetches the Authorization Server Metadata document.
 *
 * @param issuer - Issuer URL found in the protected resource metadata.
 */
export async function discoverAuthorizationServerMetadata(
  issuer: string,
): Promise<AuthorizationServerMetadata> {
  const url = new URL("/.well-known/oauth-authorization-server", issuer);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `Authorization server metadata fetch failed for ${issuer}: HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<AuthorizationServerMetadata>;
}

/**
 * Convenience: discover the full authorization server metadata for an MCP
 * resource in one call.
 *
 * Returns the first authorization server listed in the protected resource
 * metadata document.
 */
export async function discoverOAuthMetadata(resourceUrl: string): Promise<{
  protected: ProtectedResourceMetadata;
  authServer: AuthorizationServerMetadata;
}> {
  const protectedMeta = await discoverProtectedResourceMetadata(resourceUrl);
  const issuer = protectedMeta.authorization_servers?.[0];
  if (!issuer) {
    throw new Error(
      `No authorization_servers listed in protected resource metadata for ${resourceUrl}`,
    );
  }
  const authServer = await discoverAuthorizationServerMetadata(issuer);
  return { protected: protectedMeta, authServer };
}
