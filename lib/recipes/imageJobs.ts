import { prisma } from "@/lib/db";
import {
  isHouseholdWorkspace,
  type Workspace,
} from "@/lib/households/shared";
import { requireHouseholdMembership } from "@/lib/households/server";
import type {
  Recipe,
  RecipeImageMetadata,
  RecipeImageStatus,
} from "@/lib/planner/types";
import {
  buildRecipeImagePrompt,
  generateAndUploadRecipeImage,
} from "@/lib/recipes/imageGeneration";

const MAX_PROCESSING_JOBS = 2;
const MAX_ATTEMPTS = 3;
const STALE_GENERATING_MS = 15 * 60 * 1000;
const PRIVATE_STORE_ACCESS_ERROR =
  "Cannot use public access on a private store";

export type RecipeImageWorkspaceScope =
  | { type: "personal"; userId: string }
  | { type: "household"; householdId: string };

type RecipeImageJobRecord = {
  id: string;
  recipeId: string;
  status: "PENDING" | "GENERATING" | "READY" | "FAILED";
  imageUrl: string | null;
  updatedAt: Date;
};

function toRecipeImageStatus(status: RecipeImageJobRecord["status"]): RecipeImageStatus {
  if (status === "PENDING") return "pending";
  if (status === "GENERATING") return "generating";
  if (status === "READY") return "ready";
  return "failed";
}

function toRecipeImageMetadata(job: RecipeImageJobRecord): RecipeImageMetadata {
  return {
    recipeId: job.recipeId,
    imageUrl:
      job.status === "READY" && job.imageUrl
        ? `/api/recipes/images/${encodeURIComponent(job.id)}`
        : undefined,
    imageStatus: toRecipeImageStatus(job.status),
    imageUpdatedAt: job.updatedAt.toISOString(),
  };
}

function imageMetadataFromRecipe(recipe: Recipe): RecipeImageMetadata | null {
  if (!recipe.imageStatus) {
    return null;
  }

  return {
    recipeId: recipe.id,
    imageUrl: recipe.imageUrl,
    imageStatus: recipe.imageStatus,
    imageUpdatedAt: recipe.imageUpdatedAt ?? new Date().toISOString(),
  };
}

function scopeWhere(scope: RecipeImageWorkspaceScope) {
  return scope.type === "household"
    ? { householdId: scope.householdId }
    : { userId: scope.userId };
}

function scopedUniqueWhere(scope: RecipeImageWorkspaceScope, recipeId: string) {
  return scope.type === "household"
    ? {
        householdId_recipeId: {
          householdId: scope.householdId,
          recipeId,
        },
      }
    : {
        userId_recipeId: {
          userId: scope.userId,
          recipeId,
        },
      };
}

function scopeCreateData(scope: RecipeImageWorkspaceScope) {
  return scope.type === "household"
    ? { householdId: scope.householdId }
    : { userId: scope.userId };
}

function uniqueRecipes(recipes: Recipe[]) {
  const recipesById = new Map<string, Recipe>();
  for (const recipe of recipes) {
    recipesById.set(recipe.id, recipe);
  }
  return Array.from(recipesById.values());
}

export async function resolveRecipeImageWorkspaceScope(
  userId: string,
  workspace: Workspace | undefined,
): Promise<RecipeImageWorkspaceScope> {
  if (workspace && isHouseholdWorkspace(workspace)) {
    await requireHouseholdMembership(userId, workspace.householdId);
    return { type: "household", householdId: workspace.householdId };
  }

  return { type: "personal", userId };
}

export async function enqueueRecipeImageJobs({
  scope,
  recipes,
}: {
  scope: RecipeImageWorkspaceScope;
  recipes: Recipe[];
}) {
  return Promise.all(
    uniqueRecipes(recipes).map(async (recipe) => {
      const existingMetadata = imageMetadataFromRecipe(recipe);
      if (
        existingMetadata?.imageStatus === "ready" &&
        existingMetadata.imageUrl
      ) {
        return existingMetadata;
      }

      const prompt = buildRecipeImagePrompt(recipe);
      const existing = await prisma.recipeImageJob.findUnique({
        where: scopedUniqueWhere(scope, recipe.id),
      });

      if (existing?.status === "READY" && existing.imageUrl) {
        return toRecipeImageMetadata(existing);
      }

      const data = {
        recipeTitle: recipe.title,
        mealType: recipe.mealType,
        cuisine: recipe.cuisine,
        prompt,
        status:
          existing?.status === "GENERATING" ? "GENERATING" : "PENDING",
        lastError: null,
        completedAt: null,
      } as const;

      const job = existing
        ? await prisma.recipeImageJob.update({
            where: { id: existing.id },
            data: {
              ...data,
              attempts: existing.status === "FAILED" ? 0 : existing.attempts,
            },
          })
        : await prisma.recipeImageJob.create({
            data: {
              ...scopeCreateData(scope),
              recipeId: recipe.id,
              ...data,
            },
          });

      return toRecipeImageMetadata(job);
    }),
  );
}

export async function getRecipeImageMetadata({
  scope,
  recipeIds,
}: {
  scope: RecipeImageWorkspaceScope;
  recipeIds: string[];
}) {
  const uniqueIds = Array.from(new Set(recipeIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return [];
  }

  const jobs = await prisma.recipeImageJob.findMany({
    where: {
      ...scopeWhere(scope),
      recipeId: { in: uniqueIds },
    },
  });

  return jobs.map(toRecipeImageMetadata);
}

export async function requeuePrivateStoreAccessFailures({
  scope,
  recipeIds,
}: {
  scope: RecipeImageWorkspaceScope;
  recipeIds: string[];
}) {
  const uniqueIds = Array.from(new Set(recipeIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return;
  }

  await prisma.recipeImageJob.updateMany({
    where: {
      ...scopeWhere(scope),
      recipeId: { in: uniqueIds },
      status: "FAILED",
      lastError: { contains: PRIVATE_STORE_ACCESS_ERROR },
    },
    data: {
      status: "PENDING",
      attempts: 0,
      lastError: null,
      startedAt: null,
      completedAt: null,
    },
  });
}

async function resetStaleGeneratingJobs(scope: RecipeImageWorkspaceScope) {
  await prisma.recipeImageJob.updateMany({
    where: {
      ...scopeWhere(scope),
      status: "GENERATING",
      updatedAt: {
        lt: new Date(Date.now() - STALE_GENERATING_MS),
      },
      attempts: {
        lt: MAX_ATTEMPTS,
      },
    },
    data: {
      status: "PENDING",
      startedAt: null,
    },
  });
}

export async function processRecipeImageQueue({
  scope,
  limit = MAX_PROCESSING_JOBS,
}: {
  scope: RecipeImageWorkspaceScope;
  limit?: number;
}) {
  await resetStaleGeneratingJobs(scope);

  const jobs = await prisma.$transaction(async (transaction) => {
    const generatingCount = await transaction.recipeImageJob.count({
      where: {
        ...scopeWhere(scope),
        status: "GENERATING",
      },
    });
    const availableSlots = Math.max(0, limit - generatingCount);
    if (availableSlots === 0) {
      return [];
    }

    const queuedJobs = await transaction.recipeImageJob.findMany({
      where: {
        ...scopeWhere(scope),
        status: "PENDING",
        attempts: {
          lt: MAX_ATTEMPTS,
        },
      },
      orderBy: [{ attempts: "asc" }, { createdAt: "asc" }],
      take: availableSlots,
    });
    const claimedJobs: typeof queuedJobs = [];

    for (const queuedJob of queuedJobs) {
      const claimed = await transaction.recipeImageJob.updateMany({
        where: {
          id: queuedJob.id,
          status: "PENDING",
        },
        data: {
          status: "GENERATING",
          attempts: {
            increment: 1,
          },
          startedAt: new Date(),
          lastError: null,
        },
      });

      if (claimed.count === 1) {
        const job = await transaction.recipeImageJob.findUnique({
          where: { id: queuedJob.id },
        });
        if (job) {
          claimedJobs.push(job);
        }
      }
    }

    return claimedJobs;
  });

  await Promise.all(
    jobs.map(async (job) => {
      try {
        const image = await generateAndUploadRecipeImage({
          recipe: {
            id: job.recipeId,
            title: job.recipeTitle,
            mealType: job.mealType as Recipe["mealType"],
            cuisine: job.cuisine ?? undefined,
            tags: [],
            ingredients: [],
          },
          prompt: job.prompt,
        });

        await prisma.recipeImageJob.update({
          where: { id: job.id },
          data: {
            status: "READY",
            imageUrl: image.imageUrl,
            mimeType: image.mimeType,
            completedAt: new Date(),
            lastError: null,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Recipe image generation failed.";
        const nextStatus = job.attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING";

        console.error(
          `Recipe image generation failed for ${job.recipeId}`,
          error,
        );
        await prisma.recipeImageJob.update({
          where: { id: job.id },
          data: {
            status: nextStatus,
            lastError: message.slice(0, 1000),
            startedAt: null,
            completedAt: nextStatus === "FAILED" ? new Date() : null,
          },
        });
      }
    }),
  );
}
