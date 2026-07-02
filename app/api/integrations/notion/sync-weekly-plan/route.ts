/**
 * POST /api/integrations/notion/sync-weekly-plan
 *
 * Syncs the current user's weekly plan and grocery cart to their connected
 * Notion workspace using the Notion MCP server.
 *
 * Requires:
 *  - The user must be signed in.
 *  - The user must have an active Notion MCP connection (connect via
 *    GET /api/integrations/mcp/notion-mcp/connect first).
 *
 * Returns a JSON summary of what was created/updated.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/session";
import { getConnection } from "@/src/lib/mcp/token-store";
import { syncToNotion } from "@/src/lib/notion-mcp/sync";
import { prisma } from "@/lib/db";
import type { AppState } from "@/lib/appState";
import type { PlannedMeal, GroceryCartItem } from "@/lib/planner/types";

export async function POST(): Promise<NextResponse> {
  const user = await requireUser();

  // Verify the user has a Notion MCP connection
  const connection = await getConnection(user.id, "notion-mcp");
  if (!connection) {
    return NextResponse.json(
      {
        error:
          "Notion is not connected. Please connect your Notion account first via /api/integrations/mcp/notion-mcp/connect.",
      },
      { status: 401 },
    );
  }

  // Load the user's app state to get the current weekly plan and grocery cart
  const appStateRecord = await prisma.userAppState.findUnique({
    where: { userId: user.id },
    select: { state: true },
  });

  if (!appStateRecord) {
    return NextResponse.json(
      { error: "App state not found. Please set up your planner first." },
      { status: 404 },
    );
  }

  const appState = appStateRecord.state as unknown as AppState;
  const meals: PlannedMeal[] = appState.planner?.weeklyPlan ?? [];
  const cartItems: GroceryCartItem[] = appState.planner?.groceryCart ?? [];

  if (meals.length === 0 && cartItems.length === 0) {
    return NextResponse.json(
      { error: "No weekly plan or grocery cart items to sync." },
      { status: 422 },
    );
  }

  try {
    const result = await syncToNotion(user.id, meals, cartItems);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("No OAuth connection") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
