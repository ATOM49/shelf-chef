import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { ensureUserWorkspaceBootstrap, HouseholdAccessError, removeHouseholdMember, updateMemberRole } from "@/lib/households/server";

function isRole(value: unknown): value is "ADMIN" | "MEMBER" {
  return value === "ADMIN" || value === "MEMBER";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberUserId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const body = (await request.json()) as { role?: unknown };
    if (!isRole(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const { householdId, memberUserId } = await params;
    await updateMemberRole({
      householdId,
      actorUserId: session.user.id,
      targetUserId: memberUserId,
      role: body.role,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to update household member" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ householdId: string; memberUserId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const { householdId, memberUserId } = await params;
    await removeHouseholdMember({
      householdId,
      actorUserId: session.user.id,
      targetUserId: memberUserId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to remove household member" }, { status: 500 });
  }
}
