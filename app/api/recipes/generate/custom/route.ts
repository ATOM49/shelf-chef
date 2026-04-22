import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { getRecipeDedupeKey, mergeRecipes } from "@/lib/appState";
import { generateCustomRecipeResponse } from "@/lib/planner/generate";
import { buildCustomRecipeGenerationPrompt } from "@/lib/planner/prompts";
import {
  customRecipeGenerateRequestSchema,
  parseCustomRecipeGenerationApiResponse,
} from "@/lib/planner/schema";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedRequest = customRecipeGenerateRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return Response.json({ error: "A valid custom recipe request is required." }, { status: 400 });
  }

  try {
    const response = await generateCustomRecipeResponse(
      buildCustomRecipeGenerationPrompt(parsedRequest.data),
      parsedRequest.data.inventory,
    );
    const generatedRecipe = {
      ...response.recipe,
      source: "user-saved" as const,
    };
    const mergedRecipeBook = mergeRecipes(parsedRequest.data.recipeBook, [generatedRecipe]);
    const resolvedRecipe =
      mergedRecipeBook.find(
        (recipe) => getRecipeDedupeKey(recipe) === getRecipeDedupeKey(generatedRecipe),
      ) ?? generatedRecipe;

    return Response.json(
      parseCustomRecipeGenerationApiResponse({
        recipe: resolvedRecipe,
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