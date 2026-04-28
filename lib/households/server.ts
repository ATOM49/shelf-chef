import { createHash, randomBytes } from "node:crypto";
import type { HouseholdRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createDefaultAppState } from "@/lib/appState";
import { HOUSEHOLD_INVITE_EXPIRY_HOURS, type HouseholdSummary, type InvitationDetails } from "@/lib/households/shared";
import { sendHouseholdInviteEmail } from "@/lib/email/sendgrid";

export class HouseholdAccessError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HouseholdAccessError";
    this.status = status;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getInviteBaseUrl() {
  const baseUrl = process.env.APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!baseUrl) {
    throw new Error("APP_URL or NEXTAUTH_URL must be configured for household invites");
  }
  return baseUrl.replace(/\/$/, "");
}

function defaultHouseholdName(user: { name?: string | null; email?: string | null }) {
  const base = user.name?.trim() || user.email?.split("@")[0]?.trim() || "My";
  const needsSuffix = base.toLowerCase().endsWith("s") ? "'" : "'s";
  return `${base}${needsSuffix} household`;
}

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensurePersonalAppState(userId: string) {
  return prisma.userAppState.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      state: createDefaultAppState() as object,
    },
  });
}

export async function ensureUserWorkspaceBootstrap(userId: string) {
  return prisma.$transaction(async (tx) => {
    const [user, personalState, membershipCount] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      }),
      tx.userAppState.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          state: createDefaultAppState() as object,
        },
      }),
      tx.householdMembership.count({ where: { userId } }),
    ]);

    if (!user) {
      throw new HouseholdAccessError("User not found", 404);
    }

    if (membershipCount === 0) {
      await tx.household.create({
        data: {
          name: defaultHouseholdName(user),
          memberships: {
            create: {
              userId,
              role: "OWNER",
            },
          },
          appState: {
            create: {
              state: personalState.state as object,
            },
          },
        },
      });
    }

    return personalState;
  });
}

export async function ensureHouseholdAppState(householdId: string) {
  return prisma.householdAppState.upsert({
    where: { householdId },
    update: {},
    create: {
      householdId,
      state: createDefaultAppState() as object,
    },
  });
}

export async function requireHouseholdMembership(userId: string, householdId: string) {
  const membership = await prisma.householdMembership.findUnique({
    where: {
      householdId_userId: {
        householdId,
        userId,
      },
    },
    include: {
      household: true,
    },
  });

  if (!membership) {
    throw new HouseholdAccessError("Household not found", 404);
  }

  return membership;
}

function canInvite(role: HouseholdRole) {
  return role === "OWNER" || role === "ADMIN";
}

function canManageMember(actorRole: HouseholdRole, targetRole: HouseholdRole) {
  if (actorRole === "OWNER") {
    return targetRole !== "OWNER";
  }
  return actorRole === "ADMIN" && targetRole === "MEMBER";
}

function pickNextOwner(
  memberships: Array<{ userId: string; role: HouseholdRole; createdAt: Date }>,
) {
  const sorted = [...memberships].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );
  return (
    sorted.find((membership) => membership.role === "ADMIN") ??
    sorted.find((membership) => membership.role === "MEMBER")
  );
}

export async function listUserHouseholds(userId: string): Promise<HouseholdSummary[]> {
  const memberships = await prisma.householdMembership.findMany({
    where: { userId },
    include: {
      household: {
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          },
          invites: {
            where: {
              acceptedAt: null,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((membership) => ({
    id: membership.household.id,
    name: membership.household.name,
    role: membership.role,
    memberCount: membership.household.memberships.length,
    members: membership.household.memberships.map((member) => ({
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
      role: member.role,
      joinedAt: member.createdAt.toISOString(),
    })),
    pendingInvites: membership.household.invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    })),
  }));
}

export async function createHouseholdInvite({
  householdId,
  actorUserId,
  email,
}: {
  householdId: string;
  actorUserId: string;
  email: string;
}) {
  const actorMembership = await requireHouseholdMembership(actorUserId, householdId);
  if (!canInvite(actorMembership.role)) {
    throw new HouseholdAccessError("Only owners and admins can invite members", 403);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new HouseholdAccessError("Email is required", 400);
  }

  const existingMember = await prisma.householdMembership.findFirst({
    where: {
      householdId,
      user: {
        email: normalizedEmail,
      },
    },
    select: { userId: true },
  });

  if (existingMember) {
    throw new HouseholdAccessError("That user is already a member of this household", 409);
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + HOUSEHOLD_INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
  const inviteUrl = `${getInviteBaseUrl()}/join/${rawToken}`;

  const invite = await prisma.$transaction(async (tx) => {
    await tx.householdInvite.updateMany({
      where: {
        householdId,
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return tx.householdInvite.create({
      data: {
        householdId,
        email: normalizedEmail,
        tokenHash,
        createdByUserId: actorUserId,
        expiresAt,
      },
      include: {
        household: {
          select: { name: true },
        },
      },
    });
  });

  try {
    await sendHouseholdInviteEmail({
      to: normalizedEmail,
      householdName: invite.household.name,
      inviteUrl,
      expiresAt,
    });
  } catch (error) {
    await prisma.householdInvite.delete({ where: { id: invite.id } }).catch(() => undefined);
    throw error;
  }
}

async function getPendingInviteByToken(token: string) {
  const invite = await prisma.householdInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      household: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date()) {
    return null;
  }

  return invite;
}

export async function getInvitationDetailsForUser({
  token,
  userId,
  email,
}: {
  token: string;
  userId: string;
  email?: string | null;
}): Promise<InvitationDetails> {
  const invite = await getPendingInviteByToken(token);
  if (!invite) {
    throw new HouseholdAccessError("This invitation is no longer valid", 404);
  }

  const normalizedEmail = normalizeEmail(email ?? "");
  if (!normalizedEmail || normalizedEmail !== invite.email) {
    throw new HouseholdAccessError(
      "Sign in with the email address that received this invite",
      403,
    );
  }

  const existingMembership = await prisma.householdMembership.findUnique({
    where: {
      householdId_userId: {
        householdId: invite.householdId,
        userId,
      },
    },
    select: { userId: true },
  });

  return {
    householdId: invite.household.id,
    householdName: invite.household.name,
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
    alreadyMember: Boolean(existingMembership),
  };
}

export async function acceptHouseholdInvite({
  token,
  userId,
  email,
}: {
  token: string;
  userId: string;
  email?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.householdInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: {
        household: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date()) {
      throw new HouseholdAccessError("This invitation is no longer valid", 404);
    }

    const normalizedEmail = normalizeEmail(email ?? "");
    if (!normalizedEmail || normalizedEmail !== invite.email) {
      throw new HouseholdAccessError(
        "Sign in with the email address that received this invite",
        403,
      );
    }

    await tx.householdMembership.upsert({
      where: {
        householdId_userId: {
          householdId: invite.householdId,
          userId,
        },
      },
      update: {},
      create: {
        householdId: invite.householdId,
        userId,
        role: "MEMBER",
      },
    });

    await tx.householdInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
      },
    });

    return {
      householdId: invite.household.id,
      householdName: invite.household.name,
    };
  });
}

export async function updateMemberRole({
  householdId,
  actorUserId,
  targetUserId,
  role,
}: {
  householdId: string;
  actorUserId: string;
  targetUserId: string;
  role: Exclude<HouseholdRole, "OWNER">;
}) {
  const [actorMembership, targetMembership] = await Promise.all([
    requireHouseholdMembership(actorUserId, householdId),
    prisma.householdMembership.findUnique({
      where: {
        householdId_userId: {
          householdId,
          userId: targetUserId,
        },
      },
    }),
  ]);

  if (!targetMembership) {
    throw new HouseholdAccessError("Member not found", 404);
  }

  if (actorMembership.role !== "OWNER") {
    throw new HouseholdAccessError("Only the owner can change household roles", 403);
  }

  if (targetMembership.role === "OWNER") {
    throw new HouseholdAccessError("The owner role can only change through ownership transfer", 409);
  }

  return prisma.householdMembership.update({
    where: { id: targetMembership.id },
    data: { role },
  });
}

export async function removeHouseholdMember({
  householdId,
  actorUserId,
  targetUserId,
}: {
  householdId: string;
  actorUserId: string;
  targetUserId: string;
}) {
  const [actorMembership, targetMembership] = await Promise.all([
    requireHouseholdMembership(actorUserId, householdId),
    prisma.householdMembership.findUnique({
      where: {
        householdId_userId: {
          householdId,
          userId: targetUserId,
        },
      },
    }),
  ]);

  if (!targetMembership) {
    throw new HouseholdAccessError("Member not found", 404);
  }

  if (actorUserId === targetUserId) {
    throw new HouseholdAccessError("Use the leave action to leave your household", 409);
  }

  if (!canManageMember(actorMembership.role, targetMembership.role)) {
    throw new HouseholdAccessError("You do not have permission to remove this member", 403);
  }

  await removeMembershipWithOwnershipTransfer(householdId, targetUserId);
}

export async function leaveHousehold({
  householdId,
  userId,
}: {
  householdId: string;
  userId: string;
}) {
  await requireHouseholdMembership(userId, householdId);
  await removeMembershipWithOwnershipTransfer(householdId, userId);
}

async function removeMembershipWithOwnershipTransfer(
  householdId: string,
  targetUserId: string,
) {
  await prisma.$transaction(async (tx) => {
    const memberships = await tx.householdMembership.findMany({
      where: { householdId },
      orderBy: { createdAt: "asc" },
    });

    const targetMembership = memberships.find((membership) => membership.userId === targetUserId);
    if (!targetMembership) {
      throw new HouseholdAccessError("Member not found", 404);
    }

    const remainingMemberships = memberships.filter(
      (membership) => membership.userId !== targetUserId,
    );

    if (remainingMemberships.length === 0) {
      await tx.household.delete({ where: { id: householdId } });
      return;
    }

    if (targetMembership.role === "OWNER") {
      const nextOwner = pickNextOwner(remainingMemberships);
      if (!nextOwner) {
        throw new HouseholdAccessError("Unable to determine the next household owner", 409);
      }

      await tx.householdMembership.update({
        where: { id: nextOwner.id },
        data: { role: "OWNER" },
      });
    }

    await tx.householdMembership.delete({ where: { id: targetMembership.id } });
  });
}
