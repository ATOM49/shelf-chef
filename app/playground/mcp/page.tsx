import {
  McpPlayground,
  type McpPlaygroundProvider,
} from "@/components/mcp/McpPlayground";
import { requireUser } from "@/src/lib/auth/session";
import {
  getMcpProvider,
  MCP_PROVIDERS,
} from "@/src/lib/mcp/providers";
import { listConnections } from "@/src/lib/mcp/token-store";

type SearchParams = Promise<{
  connected?: string | string[];
  error?: string | string[];
  provider?: string | string[];
}>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildNotice(searchParams: Awaited<SearchParams>) {
  const providerKey = getSingleValue(searchParams.provider);
  const connectedKey = getSingleValue(searchParams.connected);
  const error = getSingleValue(searchParams.error);

  if (error) {
    const label = providerKey ? getMcpProvider(providerKey)?.label ?? providerKey : null;
    return {
      tone: "error" as const,
      message: label ? `${label} connection failed: ${error}` : error,
    };
  }

  if (connectedKey) {
    const label = getMcpProvider(connectedKey)?.label ?? connectedKey;
    return {
      tone: "success" as const,
      message: `${label} connected successfully.`,
    };
  }

  return null;
}

export default async function McpPlaygroundPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser({ callbackUrl: "/playground/mcp" });
  const resolvedSearchParams = await searchParams;
  const connections = await listConnections(user.id);
  const connectionLookup = new Map(
    connections.map((connection) => [connection.providerKey, connection]),
  );

  const providers: McpPlaygroundProvider[] = Object.values(MCP_PROVIDERS).map(
    (provider) => {
      const connection = connectionLookup.get(provider.key);

      return {
        key: provider.key,
        label: provider.label,
        mcpServerUrl: provider.mcpServerUrl,
        scopes: provider.scopes ?? [],
        connected: !!connection,
        expiresAt: connection?.expiresAt?.toISOString() ?? null,
        tokenType: connection?.tokenType ?? null,
        grantedScope: connection?.scope ?? null,
      };
    },
  );

  return (
    <McpPlayground
      providers={providers}
      initialNotice={buildNotice(resolvedSearchParams)}
    />
  );
}