import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await prisma.userAppState.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ state: record?.state ?? null });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { state: unknown };

  // null state means the user reset the app — delete any stored record
  if (body.state === null) {
    await prisma.userAppState.deleteMany({
      where: { userId: session.user.id },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.userAppState.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      state: body.state as object,
    },
    update: {
      state: body.state as object,
    },
  });

  return NextResponse.json({ ok: true });
}
