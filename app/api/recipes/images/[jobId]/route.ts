import { get } from "@vercel/blob";

import { prisma } from "@/lib/db";
import { requireHouseholdMembership } from "@/lib/households/server";
import { auth } from "@/src/auth";

type RecipeImageRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(
  request: Request,
  context: RecipeImageRouteContext,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const job = await prisma.recipeImageJob.findUnique({
    where: { id: jobId },
    select: {
      userId: true,
      householdId: true,
      status: true,
      imageUrl: true,
    },
  });

  if (!job || job.status !== "READY" || !job.imageUrl) {
    return Response.json({ error: "Recipe image not found" }, { status: 404 });
  }

  if (job.userId !== session.user.id) {
    if (!job.householdId) {
      return Response.json({ error: "Recipe image not found" }, { status: 404 });
    }

    try {
      await requireHouseholdMembership(session.user.id, job.householdId);
    } catch {
      return Response.json({ error: "Recipe image not found" }, { status: 404 });
    }
  }

  try {
    const image = await get(job.imageUrl, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    });

    if (!image) {
      return Response.json({ error: "Recipe image not found" }, { status: 404 });
    }

    const cacheHeaders = {
      "Cache-Control": "private, max-age=86400, must-revalidate",
      ETag: image.blob.etag,
    };

    if (image.statusCode === 304) {
      return new Response(null, {
        status: 304,
        headers: cacheHeaders,
      });
    }

    return new Response(image.stream, {
      headers: {
        ...cacheHeaders,
        "Content-Type": image.blob.contentType,
        "Content-Length": String(image.blob.size),
      },
    });
  } catch (error) {
    console.error(`Unable to load recipe image ${jobId}`, error);
    return Response.json(
      { error: "Unable to load recipe image" },
      { status: 502 },
    );
  }
}
