import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { createHouseholdInvite, ensureUserWorkspaceBootstrap, HouseholdAccessError } from "@/lib/households/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const body = (await request.json()) as { email?: string };
    const { householdId } = await params;

    if (!body.email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await createHouseholdInvite({
      householdId,
      actorUserId: session.user.id,
      email: body.email,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to create invite" }, { status: 500 });
  }
}
