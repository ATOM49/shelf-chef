"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { saveWorkspacePreference } from "@/lib/persistence";
import type { InvitationDetails } from "@/lib/households/shared";

export function JoinHouseholdClient({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        setError(null);
        setIsLoading(true);
        const response = await fetch(`/api/invitations/${token}`);
        const data = (await response.json()) as {
          error?: string;
          invitation?: InvitationDetails;
        };

        if (!response.ok || !data.invitation) {
          throw new Error(data.error ?? "Unable to load invitation");
        }

        if (!isCancelled) {
          setInvitation(data.invitation);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load invitation",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  async function acceptInvite() {
    setError(null);
    setIsAccepting(true);

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as {
        error?: string;
        householdId?: string;
      };

      if (!response.ok || !data.householdId) {
        throw new Error(data.error ?? "Unable to accept invitation");
      }

      saveWorkspacePreference({ type: "household", householdId: data.householdId });
      router.push("/");
      router.refresh();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Unable to accept invitation",
      );
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <main className="min-h-svh bg-muted/40 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-4xl items-center justify-center">
        <Card className="w-full max-w-xl border border-border/60 bg-background shadow-lg">
          <CardHeader className="space-y-3">
            <Badge variant="outline" className="w-fit">
              Household invite
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Join a ShelfChef household</CardTitle>
              <CardDescription>
                Accepting this invite keeps your personal workspace and adds a new shared household workspace.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading invitation…</p>
            ) : invitation ? (
              <div className="rounded-xl border p-4">
                <div className="text-base font-semibold">{invitation.householdName}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Invited email: {invitation.email}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Expires: {new Date(invitation.expiresAt).toLocaleString()}
                </div>
                {invitation.alreadyMember ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    You’re already a member. Accepting will just reopen the shared workspace.
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/")}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void acceptInvite()}
              disabled={isLoading || isAccepting || !invitation}
            >
              {invitation?.alreadyMember ? "Open household" : "Accept invite"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
