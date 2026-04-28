export type HouseholdRole = "OWNER" | "ADMIN" | "MEMBER";

export type Workspace =
  | { type: "personal" }
  | { type: "household"; householdId: string };

export type HouseholdMemberSummary = {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: HouseholdRole;
  joinedAt: string;
};

export type HouseholdInviteSummary = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export type HouseholdSummary = {
  id: string;
  name: string;
  role: HouseholdRole;
  members: HouseholdMemberSummary[];
  pendingInvites: HouseholdInviteSummary[];
  memberCount: number;
};

export type InvitationDetails = {
  householdId: string;
  householdName: string;
  email: string;
  expiresAt: string;
  alreadyMember: boolean;
};

export const DEFAULT_WORKSPACE: Workspace = { type: "personal" };
export const HOUSEHOLD_INVITE_EXPIRY_HOURS = 48;

export function isHouseholdWorkspace(
  workspace: Workspace,
): workspace is Extract<Workspace, { type: "household" }> {
  return workspace.type === "household";
}

export function serializeWorkspace(workspace: Workspace) {
  return workspace.type === "personal"
    ? "personal"
    : `household:${workspace.householdId}`;
}

export function parseSerializedWorkspace(value: string | null | undefined): Workspace {
  if (!value || value === "personal") {
    return DEFAULT_WORKSPACE;
  }

  if (value.startsWith("household:")) {
    const householdId = value.slice("household:".length).trim();
    if (householdId) {
      return { type: "household", householdId };
    }
  }

  return DEFAULT_WORKSPACE;
}

export function normalizeWorkspace(
  workspace: Workspace,
  households: Pick<HouseholdSummary, "id">[],
): Workspace {
  if (!isHouseholdWorkspace(workspace)) {
    return DEFAULT_WORKSPACE;
  }

  return households.some((household) => household.id === workspace.householdId)
    ? workspace
    : DEFAULT_WORKSPACE;
}
