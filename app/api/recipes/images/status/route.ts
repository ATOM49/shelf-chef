import { after, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/src/auth";
import { HouseholdAccessError } from "@/lib/households/server";
import { DEFAULT_WORKSPACE } from "@/lib/households/shared";
import {
  getRecipeImageMetadata,
  processRecipeImageQueue,
  requeuePrivateStoreAccessFailures,
  resolveRecipeImageWorkspaceScope,
} from "@/lib/recipes/imageJobs";

export const maxDuration = 300;

const workspaceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("personal") }).strict(),
  z.object({
    type: z.literal("household"),
    householdId: z.string().trim().min(1).max(160),
  }).strict(),
]);

const recipeImageStatusRequestSchema = z.object({
  recipeIds: z.array(z.string().trim().min(1).max(160)).min(1).max(120),
  workspace: workspaceSchema.optional(),
}).strict();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedRequest = recipeImageStatusRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return Response.json(
      { error: "A valid recipe image status request is required." },
      { status: 400 },
    );
  }

  try {
    const scope = await resolveRecipeImageWorkspaceScope(
      session.user.id,
      parsedRequest.data.workspace ?? DEFAULT_WORKSPACE,
    );
    await requeuePrivateStoreAccessFailures({
      scope,
      recipeIds: parsedRequest.data.recipeIds,
    });
    const images = await getRecipeImageMetadata({
      scope,
      recipeIds: parsedRequest.data.recipeIds,
    });

    if (images.some((image) => image.imageStatus === "pending")) {
      after(async () => {
        try {
          await processRecipeImageQueue({ scope });
        } catch (error) {
          console.error("Recipe image queue processing failed", error);
        }
      });
    }

    return Response.json({ images });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json(
      { error: "Unable to load recipe image status" },
      { status: 500 },
    );
  }
}
