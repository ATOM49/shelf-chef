import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { ensureUserWorkspaceBootstrap, HouseholdAccessError, listUserHouseholds } from "@/lib/households/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserWorkspaceBootstrap(session.user.id);
    const households = await listUserHouseholds(session.user.id);
    return NextResponse.json({ households });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to load households" }, { status: 500 });
  }
}
