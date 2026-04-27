import { auth } from "@/src/auth";
import { redirect } from "next/navigation";

/**
 * Returns the current session user, or throws a redirect to the sign-in page.
 *
 * Use this inside Server Components, Server Actions, and Route Handlers that
 * must only be accessible to authenticated users.
 *
 * @example
 * ```ts
 * const user = await requireUser();
 * // user.id, user.name, user.email are available
 * ```
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }
  return session.user as { id: string; name?: string | null; email?: string | null; image?: string | null };
}

/**
 * Returns the current session user, or null if the user is not authenticated.
 */
export async function getOptionalUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; email?: string | null; image?: string | null };
}
