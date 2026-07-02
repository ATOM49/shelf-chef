import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ensureUserWorkspaceBootstrap } from "@/lib/userAppState";

// Dev-only login: lets Playwright (and local devs) sign in without going
// through Google OAuth. Hard-gated on NODE_ENV so it can never be reached
// in a production deployment, even if ENABLE_DEV_LOGIN is accidentally set.
export const isDevLoginEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEV_LOGIN === "true";

const SESSION_COOKIE_NAME = "authjs.session-token";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const providers = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
  // GitHub({
  //   clientId: process.env.GITHUB_CLIENT_ID!,
  //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  // }),
];

export const providerMap = providers.map((provider) => ({
  id: provider.id,
  name: provider.name,
}));

// Auth.js's Credentials provider always signs its session as a JWT, even
// when `session.strategy` is "database" (see @auth/core's callback handler),
// so it can't be used here without splitting session storage in two. Instead
// this creates a real Session row via Prisma directly, the same way the
// database-session flow OAuth uses does, so `auth()` can read it back normally.
export async function devSignIn(email: string, password: string) {
  if (!isDevLoginEnabled) {
    throw new Error("Dev login is disabled");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !process.env.DEV_LOGIN_PASSWORD || password !== process.env.DEV_LOGIN_PASSWORD) {
    throw new Error("Invalid dev login email or password");
  }

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail, name: normalizedEmail.split("@")[0] },
  });

  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const session = await prisma.session.create({
    data: {
      sessionToken: crypto.randomUUID(),
      userId: user.id,
      expires,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  await ensureUserWorkspaceBootstrap(user.id);

  return user;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: "/signin",
    signOut: "/signout",
  },
  session: {
    // Database sessions allow server-side token revocation and keep JWT
    // payloads lean. The Prisma adapter handles session storage.
    strategy: "database",
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        await ensureUserWorkspaceBootstrap(user.id);
      }
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
