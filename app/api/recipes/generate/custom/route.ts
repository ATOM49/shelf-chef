import type { NextRequest } from "next/server";
import { after } from "next/server";
import { auth } from "@/src/auth";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { getRecipeDedupeKey, mergeRecipes } from "@/lib/appState";
import { HouseholdAccessError } from "@/lib/households/server";
import { generateCustomRecipeResponse } from "@/lib/planner/generate";
import {
  buildDishRecipeGenerationPrompt,
  buildIngredientRecipeGenerationPrompt,
} from "@/lib/planner/prompts";
import {
  customRecipeGenerateRequestSchema,
  parseCustomRecipeGenerationApiResponse,
} from "@/lib/planner/schema";
import {
  enqueueRecipeImageJobs,
  processRecipeImageQueue,
  resolveRecipeImageWorkspaceScope,
} from "@/lib/recipes/imageJobs";

export const maxDuration = 300;

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
    const requestData = parsedRequest.data;
    const prompt =
      requestData.mode === "dish"
        ? buildDishRecipeGenerationPrompt(requestData)
        : buildIngredientRecipeGenerationPrompt(requestData);
    const inventoryForGeneration = requestData.mode === "dish" ? [] : requestData.inventory;

    const response = await generateCustomRecipeResponse(prompt, inventoryForGeneration);
    const generatedRecipe = {
      ...response.recipe,
      source: "user-saved" as const,
    };
    const mergedRecipeBook = mergeRecipes(parsedRequest.data.recipeBook, [generatedRecipe]);
    const resolvedRecipe =
      mergedRecipeBook.find(
        (recipe) => getRecipeDedupeKey(recipe) === getRecipeDedupeKey(generatedRecipe),
      ) ?? generatedRecipe;
    const session = await auth();
    let recipeWithImageMetadata = resolvedRecipe;
    if (session?.user?.id) {
      const scope = await resolveRecipeImageWorkspaceScope(
        session.user.id,
        parsedRequest.data.workspace,
      );
      const imageMetadata = await enqueueRecipeImageJobs({
        scope,
        recipes: [resolvedRecipe],
      });
      const metadata = imageMetadata.find(
        (candidate) => candidate.recipeId === resolvedRecipe.id,
      );
      if (metadata) {
        recipeWithImageMetadata = {
          ...resolvedRecipe,
          imageUrl: metadata.imageUrl,
          imageStatus: metadata.imageStatus,
          imageUpdatedAt: metadata.imageUpdatedAt,
        };
      }

      after(async () => {
        try {
          await processRecipeImageQueue({ scope });
        } catch (error) {
          console.error("Recipe image queue processing failed", error);
        }
      });
    }

    return Response.json(
      parseCustomRecipeGenerationApiResponse({
        recipe: recipeWithImageMetadata,
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
