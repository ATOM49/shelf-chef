import { createDefaultAppState } from "@/lib/appState";
import { prisma } from "@/lib/db";

export async function ensureUserAppState(userId: string) {
  return prisma.userAppState.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      state: createDefaultAppState() as object,
    },
  });
}
