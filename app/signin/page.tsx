import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth, providerMap, signIn } from "@/src/auth";
import { redirect } from "next/navigation";

type SignInSearchParams = Promise<{
  callbackUrl?: string | string[];
  error?: string | string[];
}>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Hmm, this account isn't authorized for ShelfChef.",
  Configuration: "Something's off on our end — authentication isn't set up correctly.",
  Default: "Sign-in didn't work. Give it another go!",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  OAuthCallback: "The sign-in provider didn't finish — please try again.",
  OAuthCreateAccount: "We couldn't create an account with that provider. Try a different one.",
  OAuthSignin: "The provider turned down the request — please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SignInSearchParams;
}) {
  const session = await auth();
  const resolvedSearchParams = await searchParams;
  const callbackUrl = getSingleValue(resolvedSearchParams.callbackUrl) ?? "/";
  const error = getSingleValue(resolvedSearchParams.error);

  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  const errorMessage = error
    ? SIGN_IN_ERROR_MESSAGES[error] ?? SIGN_IN_ERROR_MESSAGES.Default
    : null;

  return (
    <main className="min-h-svh bg-muted/40 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-5xl items-center justify-center">
        <Card className="w-full max-w-md border border-border/60 bg-background shadow-lg">
          <CardHeader className="space-y-3">
            <Badge variant="outline" className="w-fit">
              Sign in
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Welcome back to ShelfChef</CardTitle>
              <CardDescription>
                Sign in to get cooking — your pantry and planner are waiting.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
            <div className="grid gap-3">
              {providerMap.map((provider) => (
                <form
                  key={provider.id}
                  action={async () => {
                    "use server";
                    await signIn(provider.id, { redirectTo: callbackUrl });
                  }}
                >
                  <Button type="submit" className="w-full justify-center" size="lg">
                    Continue with {provider.name}
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-start text-sm text-muted-foreground">
            We&apos;ll take you back to where you were once you&apos;re in.
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}