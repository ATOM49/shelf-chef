import { auth } from "@/src/auth";
import { redirect } from "next/navigation";

type AuthenticatedUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type RequireUserOptions = {
  callbackUrl?: string;
};

function buildSignInUrl(callbackUrl?: string) {
  const signInPath = "/signin";

  if (!callbackUrl) {
    return signInPath;
  }

  const searchParams = new URLSearchParams({ callbackUrl });
  return `${signInPath}?${searchParams.toString()}`;
}

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
export async function requireUser(options?: RequireUserOptions) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildSignInUrl(options?.callbackUrl));
  }
  return session.user as AuthenticatedUser;
}

/**
 * Returns the current session user, or null if the user is not authenticated.
 */
export async function getOptionalUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as AuthenticatedUser;
}
