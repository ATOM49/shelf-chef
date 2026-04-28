import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { ensureUserWorkspaceBootstrap, getInvitationDetailsForUser, HouseholdAccessError } from "@/lib/households/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const { token } = await params;
    const invitation = await getInvitationDetailsForUser({
      token,
      userId: session.user.id,
      email: session.user.email,
    });

    return NextResponse.json({ invitation });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to load invitation" }, { status: 500 });
  }
}
