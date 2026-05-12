import { prisma } from "@/lib/db";
import type { InstamartWorkflowState, InstamartWorkflowStatus } from "@/src/lib/instamart/workflow";

export type InstamartSessionRecord = {
  id: string;
  userId: string;
  status: InstamartWorkflowStatus;
  state: InstamartWorkflowState;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

type RawSession = {
  id: string;
  userId: string;
  status: string;
  state: unknown;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

function toSessionRecord(row: RawSession): InstamartSessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as InstamartWorkflowStatus,
    state: row.state as InstamartWorkflowState,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

export async function createInstamartSession(
  userId: string,
  state: InstamartWorkflowState,
): Promise<InstamartSessionRecord> {
  const row = await prisma.instamartWorkflowSession.create({
    data: {
      userId,
      status: state.status,
      state,
      completedAt: state.status === "completed" || state.status === "cancelled" ? new Date() : null,
    },
  });
  return toSessionRecord(row);
}

export async function createInstamartSessionWithSupersede(params: {
  userId: string;
  state: InstamartWorkflowState;
  previousSessionId?: string;
  previousSessionState?: InstamartWorkflowState;
}): Promise<InstamartSessionRecord> {
  const row = await prisma.$transaction(async (tx) => {
    if (params.previousSessionId && params.previousSessionState) {
      await tx.instamartWorkflowSession.update({
        where: { id: params.previousSessionId },
        data: {
          status: "cancelled",
          state: {
            ...params.previousSessionState,
            status: "cancelled",
            stage: "cancelled",
            summary: [
              ...params.previousSessionState.summary,
              "Superseded by a new Instamart workflow session.",
            ],
            updatedAt: new Date().toISOString(),
          },
          completedAt: new Date(),
        },
      });
    }

    return tx.instamartWorkflowSession.create({
      data: {
        userId: params.userId,
        status: params.state.status,
        state: params.state,
        completedAt:
          params.state.status === "completed" || params.state.status === "cancelled"
            ? new Date()
            : null,
      },
    });
  });

  return toSessionRecord(row);
}

export async function updateInstamartSession(
  sessionId: string,
  state: InstamartWorkflowState,
): Promise<InstamartSessionRecord> {
  const row = await prisma.instamartWorkflowSession.update({
    where: { id: sessionId },
    data: {
      status: state.status,
      state,
      completedAt: state.status === "completed" || state.status === "cancelled" ? new Date() : null,
    },
  });
  return toSessionRecord(row);
}

export async function getInstamartSessionForUser(
  userId: string,
  sessionId: string,
): Promise<InstamartSessionRecord | null> {
  const row = await prisma.instamartWorkflowSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });
  return row ? toSessionRecord(row) : null;
}

export async function getLatestOpenInstamartSessionForUser(
  userId: string,
): Promise<InstamartSessionRecord | null> {
  const row = await prisma.instamartWorkflowSession.findFirst({
    where: {
      userId,
      status: {
        in: ["in_progress", "awaiting_approval"],
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  return row ? toSessionRecord(row) : null;
}
