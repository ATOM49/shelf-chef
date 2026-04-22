import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { mergeRecipes } from "@/lib/appState";
import { generateRecipeResponse } from "@/lib/planner/generate";
import { buildRecipeGenerationPrompt } from "@/lib/planner/prompts";
import {
  parseRecipeGenerationApiResponse,
  plannerGenerateRequestSchema,
} from "@/lib/planner/schema";

export async function POST(req: NextRequest) {
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
      parsedRequest.data.preferredDishes,
      parsedRequest.data.inventory,
    );
    return Response.json(
      parseRecipeGenerationApiResponse({
        recipes: mergeRecipes(parsedRequest.data.recipeBook, response.recipes),
      }),
    );
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