import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { acceptHouseholdInvite, ensureUserWorkspaceBootstrap, HouseholdAccessError } from "@/lib/households/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const body = (await request.json()) as { token?: string };
    if (!body.token) {
      return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });
    }

    const result = await acceptHouseholdInvite({
      token: body.token,
      userId: session.user.id,
      email: session.user.email,
    });

    return NextResponse.json({ ok: true, householdId: result.householdId });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to accept invitation" }, { status: 500 });
  }
}
