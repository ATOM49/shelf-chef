import { isPostHogFeatureEnabled } from "@/src/lib/posthog/feature-flags";

/**
 * Registry of supported MCP providers.
 *
 * Each entry describes one external MCP server the user may connect to.
 * The `mcpServerUrl` is the canonical resource URI used in OAuth flows as the
 * `resource` parameter (RFC 8707).
 *
 * Provider-specific OAuth credentials are supplied via environment variables:
 *   MCP_<PROVIDER_KEY_UPPER>_CLIENT_ID
 *   MCP_<PROVIDER_KEY_UPPER>_CLIENT_SECRET
 * where PROVIDER_KEY_UPPER is the `key` with dashes replaced by underscores,
 * uppercased.  For example the key "notion-mcp" maps to
 *   MCP_NOTION_MCP_CLIENT_ID / MCP_NOTION_MCP_CLIENT_SECRET
 */
export type McpProviderConfig = {
  /** Stable identifier used in URL paths and the DB. */
  key: string;
  /** Human-readable display name. */
  label: string;
  /** Canonical MCP server base URL (also used as the OAuth `resource`). */
  mcpServerUrl: string;
  /** OAuth scopes to request during the connect flow. */
  scopes?: string[];
  /** Optional PostHog feature flag key that must be enabled for this provider. */
  featureFlagKey?: string;
};

export const MCP_PROVIDERS: Record<string, McpProviderConfig> = {
  "notion-mcp": {
    key: "notion-mcp",
    label: "Notion",
    mcpServerUrl: "https://mcp.notion.com/mcp",
    scopes: ["read_content", "update_content"],
    featureFlagKey: "mcp-provider-notion",
  },
  "github-mcp": {
    key: "github-mcp",
    label: "GitHub",
    mcpServerUrl: "https://api.githubcopilot.com/mcp",
    scopes: ["read:user", "repo"],
  },
  "swiggy-instamart-mcp": {
    key: "swiggy-instamart-mcp",
    label: "Swiggy Instamart",
    // Reference: https://mcp.swiggy.com/builders/docs/start/coding-agents/
    mcpServerUrl: "https://mcp.swiggy.com/im",
    scopes: ["mcp:tools"],
    featureFlagKey: "mcp-provider-swiggy-instamart",
  },
};

/** Look up a provider by its key. Returns `undefined` for unknown keys. */
export function getMcpProvider(key: string): McpProviderConfig | undefined {
  return MCP_PROVIDERS[key];
}

/** Returns true when a known provider is available in the current deployment. */
export async function isMcpProviderEnabled(
  provider: McpProviderConfig,
  distinctId: string,
): Promise<boolean> {
  if (!provider.featureFlagKey) {
    return true;
  }

  return isPostHogFeatureEnabled(provider.featureFlagKey, distinctId);
}

/** Look up a provider by key, excluding providers disabled by feature flags. */
export async function getEnabledMcpProvider(
  key: string,
  distinctId: string,
): Promise<McpProviderConfig | undefined> {
  const provider = getMcpProvider(key);
  return provider && (await isMcpProviderEnabled(provider, distinctId))
    ? provider
    : undefined;
}

/** List providers available in the current deployment. */
export async function getEnabledMcpProviders(
  distinctId: string,
): Promise<McpProviderConfig[]> {
  const providers = await Promise.all(
    Object.values(MCP_PROVIDERS).map(async (provider) => ({
      provider,
      enabled: await isMcpProviderEnabled(provider, distinctId),
    })),
  );

  return providers
    .filter(({ enabled }) => enabled)
    .map(({ provider }) => provider);
}

/**
 * Derives the environment-variable prefix for a given provider key.
 *
 * @example envPrefix("notion-mcp") // "MCP_NOTION_MCP"
 */
export function envPrefix(providerKey: string): string {
  return `MCP_${providerKey.replace(/-/g, "_").toUpperCase()}`;
}

/** Returns the OAuth client ID for a provider (from environment). */
export function getClientId(providerKey: string): string {
  const key = `${envPrefix(providerKey)}_CLIENT_ID`;
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

/** Returns the OAuth client secret for a provider (from environment). */
export function getClientSecret(providerKey: string): string {
  const key = `${envPrefix(providerKey)}_CLIENT_SECRET`;
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}
