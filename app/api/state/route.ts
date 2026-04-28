import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { prisma } from "@/lib/db";
import { parsePersistedAppState } from "@/lib/persistence";
import { ensureHouseholdAppState, ensureUserWorkspaceBootstrap, HouseholdAccessError, requireHouseholdMembership } from "@/lib/households/server";
import type { Workspace } from "@/lib/households/shared";
import { isHouseholdWorkspace } from "@/lib/households/shared";
import { ensureUserAppState } from "@/lib/userAppState";

// Maximum allowed state payload size (1 MB)
const MAX_STATE_BYTES = 1_000_000;

function parseWorkspaceFromUrl(request: Request): Workspace {
  const url = new URL(request.url);
  const workspace = url.searchParams.get("workspace");
  const householdId = url.searchParams.get("householdId")?.trim();

  if (workspace === "household" && householdId) {
    return { type: "household", householdId };
  }

  return { type: "personal" };
}

function parseWorkspaceFromBody(body: unknown): Workspace {
  if (
    typeof body === "object" &&
    body !== null &&
    "workspace" in body &&
    typeof body.workspace === "object" &&
    body.workspace !== null &&
    "type" in body.workspace
  ) {
    const workspace = body.workspace as { type?: unknown; householdId?: unknown };
    const householdId =
      typeof workspace.householdId === "string" ? workspace.householdId.trim() : "";
    if (workspace.type === "household" && householdId) {
      return { type: "household", householdId };
    }
  }

  return { type: "personal" };
}

async function getWorkspaceState(userId: string, workspace: Workspace) {
  if (!isHouseholdWorkspace(workspace)) {
    const record = await ensureUserAppState(userId);
    return record.state;
  }

  await requireHouseholdMembership(userId, workspace.householdId);
  const record = await ensureHouseholdAppState(workspace.householdId);
  return record.state;
}

async function resetWorkspaceState(userId: string, workspace: Workspace) {
  if (!isHouseholdWorkspace(workspace)) {
    await prisma.userAppState.deleteMany({
      where: { userId },
    });
    return;
  }

  await requireHouseholdMembership(userId, workspace.householdId);
  await prisma.householdAppState.deleteMany({
    where: { householdId: workspace.householdId },
  });
}

async function saveWorkspaceState(userId: string, workspace: Workspace, state: object) {
  if (!isHouseholdWorkspace(workspace)) {
    await prisma.userAppState.upsert({
      where: { userId },
      create: {
        userId,
        state,
      },
      update: {
        state,
      },
    });
    return;
  }

  await requireHouseholdMembership(userId, workspace.householdId);
  await prisma.householdAppState.upsert({
    where: { householdId: workspace.householdId },
    create: {
      householdId: workspace.householdId,
      state,
    },
    update: {
      state,
    },
  });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const workspace = parseWorkspaceFromUrl(request);
    const state = await getWorkspaceState(session.user.id, workspace);

    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to load state" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_STATE_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const body = (await request.json()) as { state: unknown; workspace?: Workspace };

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const workspace = parseWorkspaceFromBody(body);

    if (body.state === null) {
      await resetWorkspaceState(session.user.id, workspace);
      return NextResponse.json({ ok: true });
    }

    const validated = parsePersistedAppState(body.state);
    if (!validated) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    await saveWorkspaceState(session.user.id, workspace, validated as object);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to save state" }, { status: 500 });
  }
}
