/**
 * MCP tool invocation.
 *
 * Makes a JSON-RPC 2.0 request to an MCP server, forwarding the stored
 * OAuth bearer token in the Authorization header.
 *
 * MCP requirement: access tokens must be sent as bearer tokens in the
 * Authorization header – never in query strings.
 *
 * See: https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/
 */

import { getConnection } from "./token-store";
import { generateId } from "@/lib/id";

/** Path on the MCP server where JSON-RPC tool calls are sent. */
const MCP_TOOL_ENDPOINT_PATH = "/mcp";

export type McpToolCall = {
  toolName: string;
  toolArgs?: Record<string, unknown>;
};

export type McpJsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: {
    name: string;
    arguments?: Record<string, unknown>;
  };
};

export type McpJsonRpcResponse<T = unknown> = {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

/**
 * Invokes an MCP tool on a remote MCP server.
 *
 * @param userId      - The authenticated user's ID (used to look up the token).
 * @param providerKey - The provider key (e.g. "notion-mcp").
 * @param mcpServerUrl - Base URL of the MCP server.
 * @param toolName    - Name of the MCP tool to call.
 * @param toolArgs    - Arguments to pass to the tool.
 * @returns The `result` field from the JSON-RPC response.
 * @throws  If the user has no stored connection, the token is missing, or the
 *          server returns an error.
 */
export async function invokeMcpTool(params: {
  userId: string;
  providerKey: string;
  mcpServerUrl: string;
  toolName: string;
  toolArgs?: Record<string, unknown>;
}): Promise<unknown> {
  const connection = await getConnection(params.userId, params.providerKey);
  if (!connection) {
    throw new Error(
      `No OAuth connection found for provider "${params.providerKey}". ` +
        `User must connect the provider first.`,
    );
  }

  // Reject expired tokens early (server will also reject them, but this gives
  // a cleaner error message)
  if (connection.expiresAt && connection.expiresAt < new Date()) {
    throw new Error(
      `Access token for provider "${params.providerKey}" has expired. ` +
        `User must reconnect the provider.`,
    );
  }

  const requestId = generateId();
  const rpcRequest: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/call",
    params: {
      name: params.toolName,
      arguments: params.toolArgs,
    },
  };

  const toolsEndpoint = new URL(MCP_TOOL_ENDPOINT_PATH, params.mcpServerUrl).toString();

  const res = await fetch(toolsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Bearer token in header – never in query string (MCP requirement)
      Authorization: `Bearer ${connection.accessToken}`,
    },
    body: JSON.stringify(rpcRequest),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`MCP server returned HTTP ${res.status}: ${detail}`);
  }

  const rpcResponse = (await res.json()) as McpJsonRpcResponse;

  if (rpcResponse.error) {
    throw new Error(
      `MCP tool error (code ${rpcResponse.error.code}): ${rpcResponse.error.message}`,
    );
  }

  return rpcResponse.result;
}
