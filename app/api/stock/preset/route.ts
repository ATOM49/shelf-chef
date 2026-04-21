import type { NextRequest } from "next/server";
import { generateStockPresetResponse } from "@/lib/stocking/generate";
import { buildPresetStockPrompt } from "@/lib/stocking/prompts";
import { stockPresetRequestSchema } from "@/lib/stocking/schema";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not configured on this server." }, { status: 500 });
  }

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
      apiKey,
    );
    return Response.json(response);
  } catch (err) {
    return Response.json(
      { error: "LLM call failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}