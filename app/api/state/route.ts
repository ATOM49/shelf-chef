import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { prisma } from "@/lib/db";
import { parsePersistedAppState } from "@/lib/persistence";
import { ensureUserAppState } from "@/lib/userAppState";

// Maximum allowed state payload size (1 MB)
const MAX_STATE_BYTES = 1_000_000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await ensureUserAppState(session.user.id);

  return NextResponse.json({ state: record.state });
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

  const body = (await request.json()) as { state: unknown };

  // null state means the user reset the app — delete any stored record
  if (body.state === null) {
    await prisma.userAppState.deleteMany({
      where: { userId: session.user.id },
    });
    return NextResponse.json({ ok: true });
  }

  // Validate that the state is a well-formed AppState before persisting
  const validated = parsePersistedAppState(body.state);
  if (!validated) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  await prisma.userAppState.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      state: validated as object,
    },
    update: {
      state: validated as object,
    },
  });

  return NextResponse.json({ ok: true });
}
