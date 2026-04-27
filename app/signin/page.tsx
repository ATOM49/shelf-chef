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
  AccessDenied: "Your account is not allowed to access ShelfChef.",
  Configuration: "Authentication is not configured correctly.",
  Default: "Authentication failed. Try again.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  OAuthCallback: "The provider did not complete the login flow.",
  OAuthCreateAccount: "We could not create an account from that provider.",
  OAuthSignin: "The provider rejected the sign-in request.",
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
                Sign in to open the planner and access your MCP playground.
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
            You will be returned to the page you originally requested after login.
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}