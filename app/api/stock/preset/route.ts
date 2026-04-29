import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { generateStockPresetResponse } from "@/lib/stocking/generate";
import { buildPresetStockPrompt } from "@/lib/stocking/prompts";
import { stockPresetRequestSchema } from "@/lib/stocking/schema";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import { PRESET_SEEDS } from "@/lib/inventory/preset-seeds";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedRequest = stockPresetRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return Response.json({ error: "A valid preset selection is required" }, { status: 400 });
  }

  const { presetId, stapleNames = [] } = parsedRequest.data;
  const normalizedStapleSet = new Set(stapleNames.map(normalizeIngredientName));

  // Serve pre-generated seed data immediately — no LLM call needed.
  // Pass useSeed=false in the request body to force an LLM call instead
  // (useful for regenerating the seed file via scripts/generate-preset-seeds.ts).
  const useSeed = (payload as Record<string, unknown>).useSeed !== false;

  if (useSeed) {
    const seedItems = PRESET_SEEDS[presetId].filter(
      (item) => !normalizedStapleSet.has(normalizeIngredientName(item.name)),
    );
    return Response.json({ items: seedItems });
  }

  try {
    const response = await generateStockPresetResponse(
      buildPresetStockPrompt(presetId, stapleNames),
    );
    // Filter out any staples that slipped through the AI response
    const filteredItems = response.items.filter(
      (item) => !normalizedStapleSet.has(normalizeIngredientName(item.name)),
    );
    return Response.json({ items: filteredItems });
  } catch (err) {
    const status = isLlmConfigurationError(err) ? 500 : 502;
    return Response.json(
      {
        error: isLlmConfigurationError(err) ? "LLM configuration error" : "LLM call failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status },
    );
  }
}