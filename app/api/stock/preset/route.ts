import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { generateStockPresetResponse } from "@/lib/stocking/generate";
import { buildPresetStockPrompt } from "@/lib/stocking/prompts";
import { stockPresetRequestSchema } from "@/lib/stocking/schema";

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

  try {
    const response = await generateStockPresetResponse(
      buildPresetStockPrompt(parsedRequest.data.presetId),
    );
    return Response.json(response);
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