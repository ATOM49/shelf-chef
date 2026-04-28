/**
 * Global setup: seed a deterministic test user + session into the DB,
 * then write a Playwright storageState file that injects the session cookie
 * so tests never touch Google OAuth.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Playwright's globalSetup runs in a plain Node context, so we load env vars
// from a local .env.test file when present (for local runs). CI injects them
// via GH Actions secrets.
import { config as loadDotenv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(__dirname, ".env.test"), override: false });

export const TEST_USER_ID = "test-e2e-user";
export const TEST_USER_EMAIL = "e2e@shelfchef.test";
export const TEST_SESSION_TOKEN = "e2e-static-session-token-do-not-use-in-prod";

const AUTH_COOKIE_NAME = "authjs.session-token";
const STORAGE_STATE_PATH = path.join(__dirname, ".auth", "user.json");

async function globalSetup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for e2e tests. Set it in tests/e2e/.env.test or as an environment variable.",
    );
  }

  // Import Prisma after env is loaded so DATABASE_URL is available
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../../generated/prisma/client.js");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // 1. Upsert deterministic test user
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: { email: TEST_USER_EMAIL, name: "E2E Test User" },
      create: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        name: "E2E Test User",
      },
    });

    // 2. Bootstrap user workspace (personal state + default household)
    const { ensureUserWorkspaceBootstrap } = await import(
      "../../lib/households/server.js"
    );
    await ensureUserWorkspaceBootstrap(TEST_USER_ID);

    // 3. Upsert a long-lived session row
    const sessionExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.session.upsert({
      where: { sessionToken: TEST_SESSION_TOKEN },
      update: { expires: sessionExpiry },
      create: {
        sessionToken: TEST_SESSION_TOKEN,
        userId: TEST_USER_ID,
        expires: sessionExpiry,
      },
    });

    // 4. Write Playwright storageState with the session cookie
    const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
    const { hostname } = new URL(baseUrl);

    fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
    fs.writeFileSync(
      STORAGE_STATE_PATH,
      JSON.stringify({
        cookies: [
          {
            name: AUTH_COOKIE_NAME,
            value: TEST_SESSION_TOKEN,
            domain: hostname,
            path: "/",
            expires: Math.floor(sessionExpiry.getTime() / 1000),
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      }),
    );

    console.log("[e2e setup] Test user and session seeded successfully.");
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
