/**
 * POST /api/integrations/mcp/[provider]/invoke
 *
 * Invokes an MCP tool on a remote MCP server using the user's stored OAuth
 * bearer token.
 *
 * Request body (JSON):
 * ```json
 * {
 *   "toolName": "search_pages",
 *   "toolArgs": { "query": "meeting notes" }
 * }
 * ```
 *
 * Response: the `result` field from the MCP JSON-RPC response.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { getMcpProvider } from "@/src/lib/mcp/providers";
import { invokeMcpTool } from "@/src/lib/mcp/invoke";

const invokeBodySchema = z.object({
  toolName: z.string().min(1),
  toolArgs: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = invokeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { toolName, toolArgs } = parsed.data;

  try {
    const result = await invokeMcpTool({
      userId: user.id,
      providerKey,
      mcpServerUrl: provider.mcpServerUrl,
      toolName,
      toolArgs,
    });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("No OAuth connection") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
