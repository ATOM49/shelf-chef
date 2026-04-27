import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth, signOut } from "@/src/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SignOutPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/signin");
  }

  return (
    <main className="min-h-svh bg-muted/40 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-5xl items-center justify-center">
        <Card className="w-full max-w-md border border-border/60 bg-background shadow-lg">
          <CardHeader className="space-y-3">
            <Badge variant="outline" className="w-fit">
              Sign out
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Leave ShelfChef?</CardTitle>
              <CardDescription>
                You can sign back in any time with the same provider.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your planner data remains local to this browser, but the current
              authenticated session will be removed.
            </p>
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/signin" });
              }}
            >
              <Button type="submit" variant="destructive">
                Sign out
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}