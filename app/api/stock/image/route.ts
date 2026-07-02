import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import { generateStockImageParseResponse } from "@/lib/stocking/generate";
import { buildStockImagePrompt } from "@/lib/stocking/prompts";
import { stockImageRequestSchema } from "@/lib/stocking/schema";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedRequest = stockImageRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return Response.json({ error: "A valid stock image is required" }, { status: 400 });
  }

  const stapleNames = parsedRequest.data.stapleNames ?? [];
  const normalizedStapleSet = new Set(stapleNames.map(normalizeIngredientName));

  try {
    const response = await generateStockImageParseResponse(
      buildStockImagePrompt(stapleNames),
      {
        data: parsedRequest.data.imageBase64,
        mimeType: parsedRequest.data.imageMimeType,
      },
    );
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
