/**
 * Notion MCP client.
 *
 * Thin wrappers around invokeMcpTool that call Notion-specific tools on the
 * hosted Notion MCP server.  All tool names and argument shapes follow the
 * Notion MCP tool documentation.
 *
 * Reference: https://www.notion.so/help/notion-mcp
 */

import { invokeMcpTool } from "@/src/lib/mcp/invoke";
import { getMcpProvider } from "@/src/lib/mcp/providers";

const PROVIDER_KEY = "notion-mcp";

function getNotionMcpServerUrl(): string {
  const provider = getMcpProvider(PROVIDER_KEY);
  if (!provider) {
    throw new Error("notion-mcp provider is not registered.");
  }
  return provider.mcpServerUrl;
}

function invoke(userId: string, toolName: string, toolArgs?: Record<string, unknown>) {
  return invokeMcpTool({
    userId,
    providerKey: PROVIDER_KEY,
    mcpServerUrl: getNotionMcpServerUrl(),
    toolName,
    toolArgs,
  });
}

// ---------------------------------------------------------------------------
// Page tools
// ---------------------------------------------------------------------------

export type NotionPageProperties = Record<string, unknown>;

export type CreatePageResult = {
  id: string;
  url: string;
  [key: string]: unknown;
};

/** Create a new Notion page, optionally under a parent page. */
export async function createPage(
  userId: string,
  args: {
    title: string;
    parentPageId?: string;
    properties?: NotionPageProperties;
  },
): Promise<CreatePageResult> {
  const result = await invoke(userId, "API-post-page", {
    parent: args.parentPageId
      ? { page_id: args.parentPageId }
      : { workspace: true },
    properties: {
      title: [{ type: "text", text: { content: args.title } }],
      ...args.properties,
    },
  });
  return result as CreatePageResult;
}

/** Update an existing Notion page's properties. */
export async function updatePage(
  userId: string,
  pageId: string,
  properties: NotionPageProperties,
): Promise<unknown> {
  return invoke(userId, "API-patch-page", { page_id: pageId, properties });
}

// ---------------------------------------------------------------------------
// Database tools
// ---------------------------------------------------------------------------

export type DatabaseProperty = {
  type: string;
  [key: string]: unknown;
};

export type CreateDatabaseResult = {
  id: string;
  url: string;
  [key: string]: unknown;
};

/** Create a Notion database under a parent page. */
export async function createDatabase(
  userId: string,
  args: {
    parentPageId: string;
    title: string;
    properties: Record<string, DatabaseProperty>;
  },
): Promise<CreateDatabaseResult> {
  const result = await invoke(userId, "API-post-database", {
    parent: { page_id: args.parentPageId },
    title: [{ type: "text", text: { content: args.title } }],
    properties: args.properties,
  });
  return result as CreateDatabaseResult;
}

// ---------------------------------------------------------------------------
// Database query / row tools
// ---------------------------------------------------------------------------

export type DatabaseQueryResult = {
  results: Array<{ id: string; properties: Record<string, unknown>; [key: string]: unknown }>;
  has_more: boolean;
  next_cursor?: string;
  [key: string]: unknown;
};

/** Query rows from a Notion database, optionally filtering by a property. */
export async function queryDatabase(
  userId: string,
  databaseId: string,
  filter?: Record<string, unknown>,
): Promise<DatabaseQueryResult> {
  const args: Record<string, unknown> = { database_id: databaseId };
  if (filter) {
    args.filter = filter;
  }
  const result = await invoke(userId, "API-post-database-query", args);
  return result as DatabaseQueryResult;
}

/** Create a new row (page) in a Notion database. */
export async function createDatabaseRow(
  userId: string,
  databaseId: string,
  properties: Record<string, unknown>,
): Promise<CreatePageResult> {
  const result = await invoke(userId, "API-post-page", {
    parent: { database_id: databaseId },
    properties,
  });
  return result as CreatePageResult;
}

/** Update an existing database row (page). */
export async function updateDatabaseRow(
  userId: string,
  pageId: string,
  properties: Record<string, unknown>,
): Promise<unknown> {
  return invoke(userId, "API-patch-page", { page_id: pageId, properties });
}

/** Archive (soft-delete) a Notion page/row. */
export async function archivePage(userId: string, pageId: string): Promise<unknown> {
  return invoke(userId, "API-patch-page", { page_id: pageId, archived: true });
}
