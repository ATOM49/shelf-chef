import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { ensureUserWorkspaceBootstrap } from "@/lib/userAppState";

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
