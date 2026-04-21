import type { NextRequest } from "next/server";
import { mergeRecipes } from "@/lib/appState";
import { generateRecipeResponse } from "@/lib/planner/generate";
import { buildRecipeGenerationPrompt } from "@/lib/planner/prompts";
import {
  parseRecipeGenerationApiResponse,
  plannerGenerateRequestSchema,
} from "@/lib/planner/schema";

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

  const parsedRequest = plannerGenerateRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return Response.json({ error: "A valid planner request is required." }, { status: 400 });
  }

  try {
    const response = await generateRecipeResponse(
      buildRecipeGenerationPrompt(parsedRequest.data),
      apiKey,
      parsedRequest.data.preferredDishes,
      parsedRequest.data.inventory,
    );
    return Response.json(
      parseRecipeGenerationApiResponse({
        recipes: mergeRecipes(parsedRequest.data.recipeBook, response.recipes),
      }),
    );
  } catch (err) {
    return Response.json(
      { error: "LLM call failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}