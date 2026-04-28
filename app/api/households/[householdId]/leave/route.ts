import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { ensureUserWorkspaceBootstrap, HouseholdAccessError, leaveHousehold } from "@/lib/households/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ householdId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const { householdId } = await params;
    await leaveHousehold({ householdId, userId: session.user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to leave household" }, { status: 500 });
  }
}
