import type { NextRequest } from "next/server";
import { getRecipeDedupeKey, mergeRecipes } from "@/lib/appState";
import { generateCustomRecipeResponse } from "@/lib/planner/generate";
import { buildCustomRecipeGenerationPrompt } from "@/lib/planner/prompts";
import {
  customRecipeGenerateRequestSchema,
  parseCustomRecipeGenerationApiResponse,
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

  const parsedRequest = customRecipeGenerateRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return Response.json({ error: "A valid custom recipe request is required." }, { status: 400 });
  }

  try {
    const response = await generateCustomRecipeResponse(
      buildCustomRecipeGenerationPrompt(parsedRequest.data),
      apiKey,
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
    return Response.json(
      { error: "LLM call failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}