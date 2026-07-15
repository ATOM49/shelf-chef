import type { NextRequest } from "next/server";
import { after } from "next/server";
import { auth } from "@/src/auth";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { getRecipeDedupeKey, mergeRecipes } from "@/lib/appState";
import { HouseholdAccessError } from "@/lib/households/server";
import { generateRecipeResponse } from "@/lib/planner/generate";
import { buildRecipeGenerationPrompt } from "@/lib/planner/prompts";
import {
  parseRecipeGenerationApiResponse,
  plannerGenerateRequestSchema,
} from "@/lib/planner/schema";
import type { Recipe, RecipeImageMetadata } from "@/lib/planner/types";
import {
  enqueueRecipeImageJobs,
  processRecipeImageQueue,
  resolveRecipeImageWorkspaceScope,
} from "@/lib/recipes/imageJobs";

export const maxDuration = 300;

function applyRecipeImageMetadata(
  recipes: Recipe[],
  imageMetadata: RecipeImageMetadata[],
) {
  if (imageMetadata.length === 0) {
    return recipes;
  }

  const metadataByRecipeId = new Map(
    imageMetadata.map((metadata) => [metadata.recipeId, metadata]),
  );

  return recipes.map((recipe) => {
    const metadata = metadataByRecipeId.get(recipe.id);
    if (!metadata) {
      return recipe;
    }

    return {
      ...recipe,
      imageUrl: metadata.imageUrl,
      imageStatus: metadata.imageStatus,
      imageUpdatedAt: metadata.imageUpdatedAt,
    };
  });
}

function resolveGeneratedRecipesInBook(
  generatedRecipes: Recipe[],
  mergedRecipeBook: Recipe[],
) {
  const generatedKeys = new Set(generatedRecipes.map(getRecipeDedupeKey));
  return mergedRecipeBook.filter((recipe) =>
    generatedKeys.has(getRecipeDedupeKey(recipe)),
  );
}

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
    const mergedRecipeBook = mergeRecipes(parsedRequest.data.recipeBook, response.recipes);
    let imageMetadata: RecipeImageMetadata[] = [];
    const session = await auth();
    if (session?.user?.id) {
      const scope = await resolveRecipeImageWorkspaceScope(
        session.user.id,
        parsedRequest.data.workspace,
      );
      imageMetadata = await enqueueRecipeImageJobs({
        scope,
        recipes: resolveGeneratedRecipesInBook(response.recipes, mergedRecipeBook),
      });
      after(async () => {
        try {
          await processRecipeImageQueue({ scope });
        } catch (error) {
          console.error("Recipe image queue processing failed", error);
        }
      });
    }

    return Response.json(
      parseRecipeGenerationApiResponse({
        recipes: applyRecipeImageMetadata(mergedRecipeBook, imageMetadata),
      }),
    );
  } catch (err) {
    const status = err instanceof HouseholdAccessError
      ? err.status
      : isLlmConfigurationError(err)
        ? 500
        : 502;
    return Response.json(
      {
        error: err instanceof HouseholdAccessError
          ? err.message
          : isLlmConfigurationError(err)
            ? "LLM configuration error"
            : "LLM call failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status },
    );
  }
}
