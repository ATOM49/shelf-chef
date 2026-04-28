"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HouseholdSummary, Workspace } from "@/lib/households/shared";

function canRemoveMember(actorRole: HouseholdSummary["role"], targetRole: HouseholdSummary["members"][number]["role"]) {
  if (actorRole === "OWNER") {
    return targetRole !== "OWNER";
  }

  return actorRole === "ADMIN" && targetRole === "MEMBER";
}

export function HouseholdSettingsDialog({
  open,
  onOpenChange,
  household,
  currentUserId,
  onHouseholdsChanged,
  onWorkspaceChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household?: HouseholdSummary;
  currentUserId?: string;
  onHouseholdsChanged: () => Promise<unknown>;
  onWorkspaceChange: (workspace: Workspace) => void;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentMember = useMemo(
    () => household?.members.find((member) => member.userId === currentUserId),
    [currentUserId, household],
  );

  async function withErrorHandling(action: () => Promise<void>) {
    setError(null);
    setIsSubmitting(true);

    try {
      await action();
      await onHouseholdsChanged();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Something went wrong",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createInvite() {
    if (!household) {
      return;
    }

    await withErrorHandling(async () => {
      const response = await fetch(`/api/households/${household.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to create invite");
      }

      setInviteEmail("");
    });
  }

  async function updateRole(userId: string, role: "ADMIN" | "MEMBER") {
    if (!household) {
      return;
    }

    await withErrorHandling(async () => {
      const response = await fetch(
        `/api/households/${household.id}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to update role");
      }
    });
  }

  async function removeMember(userId: string) {
    if (!household) {
      return;
    }

    await withErrorHandling(async () => {
      const response = await fetch(
        `/api/households/${household.id}/members/${userId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to remove member");
      }
    });
  }

  async function leaveHousehold() {
    if (!household) {
      return;
    }

    await withErrorHandling(async () => {
      const response = await fetch(`/api/households/${household.id}/leave`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to leave household");
      }

      onWorkspaceChange({ type: "personal" });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Household settings</DialogTitle>
          <DialogDescription>
            {household
              ? "Manage members, invitations, and your shared workspace access."
              : "Switch to a household workspace to manage membership and invitations."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 overflow-y-auto px-4 pb-4">
          {household ? (
            <>
              <section className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{household.name}</h3>
                  <Badge variant="outline">{household.role.toLowerCase()}</Badge>
                  <Badge variant="outline">{household.memberCount} members</Badge>
                </div>
              </section>

              {(household.role === "OWNER" || household.role === "ADMIN") && (
                <section className="rounded-xl border p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      <Label htmlFor="household-invite-email">Invite by email</Label>
                      <Input
                        id="household-invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="teammate@example.com"
                        disabled={isSubmitting}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => void createInvite()}
                      disabled={isSubmitting || inviteEmail.trim().length === 0}
                    >
                      Send invite
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Invites expire after 48 hours and can only be used once.
                  </p>
                </section>
              )}

              <section className="rounded-xl border p-4">
                <div className="mb-3">
                  <h3 className="text-base font-semibold">Members</h3>
                </div>
                <div className="space-y-3">
                  {household.members.map((member) => {
                    const isSelf = member.userId === currentUserId;
                    const canEditRole =
                      household.role === "OWNER" && !isSelf && member.role !== "OWNER";
                    const canRemove = canRemoveMember(household.role, member.role) && !isSelf;

                    return (
                      <div
                        key={member.userId}
                        className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {member.name || member.email}
                            </span>
                            {isSelf ? <Badge variant="outline">You</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canEditRole ? (
                            <Select
                              value={member.role}
                              onValueChange={(value) =>
                                void updateRole(member.userId, value as "ADMIN" | "MEMBER")
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MEMBER">Member</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{member.role.toLowerCase()}</Badge>
                          )}
                          {canRemove ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void removeMember(member.userId)}
                              disabled={isSubmitting}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border p-4">
                <div className="mb-3">
                  <h3 className="text-base font-semibold">Pending invites</h3>
                </div>
                {household.pendingInvites.length > 0 ? (
                  <div className="space-y-2">
                    {household.pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="rounded-lg border border-dashed px-3 py-2 text-sm"
                      >
                        <div className="font-medium">{invite.email}</div>
                        <div className="text-muted-foreground">
                          Expires {new Date(invite.expiresAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No pending invites.
                  </p>
                )}
              </section>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Personal workspaces are private. Switch to a household from the workspace selector to invite people or manage roles.
            </div>
          )}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter showCloseButton>
          {household && currentMember ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void leaveHousehold()}
              disabled={isSubmitting}
            >
              Leave household
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
