import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { getRecipeDedupeKey, mergeRecipes } from "@/lib/appState";
import { generateCustomRecipeResponse } from "@/lib/planner/generate";
import { buildVoiceRecipeGenerationPrompt } from "@/lib/planner/prompts";
import {
  customRecipeGenerateRequestSchema,
  parseCustomRecipeGenerationApiResponse,
} from "@/lib/planner/schema";

const MAX_TRANSCRIPT_LENGTH = 2000;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const { transcript, preferences, recipeBook } = body as Record<string, unknown>;

  if (typeof transcript !== "string" || transcript.trim().length === 0) {
    return Response.json({ error: "A non-empty transcript is required." }, { status: 400 });
  }

  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return Response.json(
      { error: `Transcript must be under ${MAX_TRANSCRIPT_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const parsedRecipeBook = customRecipeGenerateRequestSchema
    .pick({ recipeBook: true })
    .safeParse({ recipeBook: recipeBook ?? [] });
  if (!parsedRecipeBook.success) {
    return Response.json({ error: "Invalid recipeBook data." }, { status: 400 });
  }

  try {
    const prompt = buildVoiceRecipeGenerationPrompt({
      transcript: transcript.trim(),
      preferences: typeof preferences === "string" ? preferences.trim() : "",
      recipeBook: parsedRecipeBook.data.recipeBook,
    });

    const response = await generateCustomRecipeResponse(prompt, []);

    const generatedRecipe = {
      ...response.recipe,
      source: "user-saved" as const,
    };

    const mergedRecipeBook = mergeRecipes(
      parsedRecipeBook.data.recipeBook,
      [generatedRecipe],
    );
    const resolvedRecipe =
      mergedRecipeBook.find(
        (recipe) => getRecipeDedupeKey(recipe) === getRecipeDedupeKey(generatedRecipe),
      ) ?? generatedRecipe;

    return Response.json(parseCustomRecipeGenerationApiResponse({ recipe: resolvedRecipe }));
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

