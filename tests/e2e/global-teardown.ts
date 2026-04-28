/**
 * Global teardown: remove all rows scoped to the test user so the staging DB
 * stays clean between runs.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(__dirname, ".env.test"), override: false });

import { TEST_USER_ID } from "./global-setup.js";

async function globalTeardown() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../../generated/prisma/client.js");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // Delete in FK-safe order; cascade handles most children but we're explicit.
    await prisma.session.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.userAppState.deleteMany({ where: { userId: TEST_USER_ID } });

    // Remove household memberships and their associated households (if the test
    // user is the only member, the household itself should be deleted too).
    const memberships = await prisma.householdMembership.findMany({
      where: { userId: TEST_USER_ID },
      select: { householdId: true },
    });
    const householdIds = memberships.map((m: { householdId: string }) => m.householdId);

    await prisma.householdMembership.deleteMany({ where: { userId: TEST_USER_ID } });

    // Only delete households where no other members remain
    for (const householdId of householdIds) {
      const remaining = await prisma.householdMembership.count({
        where: { householdId },
      });
      if (remaining === 0) {
        await prisma.householdAppState.deleteMany({ where: { householdId } });
        await prisma.household.delete({ where: { id: householdId } });
      }
    }

    await prisma.account.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });

    console.log("[e2e teardown] Test user data removed.");
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
