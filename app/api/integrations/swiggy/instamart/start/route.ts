import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { createInstamartSessionWithSupersede, getLatestOpenInstamartSessionForUser } from "@/src/lib/instamart/session-store";
import { createInstamartToolCaller, SwiggyReauthorizeRequiredError } from "@/src/lib/instamart/mcp";
import {
  INSTAMART_PROVIDER_KEY,
  startInstamartWorkflow,
  type InstamartCartLine,
} from "@/src/lib/instamart/workflow";
import { generateId } from "@/lib/id";

const draftItemSchema = z.object({
  spinId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const startBodySchema = z.object({
  selectedAddressId: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  useGoToItems: z.boolean().optional(),
  draftItems: z.array(draftItemSchema).optional(),
});

function toCartLines(lines: z.infer<typeof draftItemSchema>[] | undefined): InstamartCartLine[] {
  if (!lines) return [];
  return lines.map((line) => ({
    spinId: line.spinId,
    quantity: line.quantity,
  }));
}

export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = startBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const toolCaller = createInstamartToolCaller(user.id);
  const previousOpenSession = await getLatestOpenInstamartSessionForUser(user.id);
  const sessionId = generateId();

  try {
    const workflowState = await startInstamartWorkflow(
      {
        sessionId,
        userId: user.id,
        selectedAddressId: parsed.data.selectedAddressId,
        query: parsed.data.query,
        useGoToItems: parsed.data.useGoToItems,
        draftItems: toCartLines(parsed.data.draftItems),
        previousAddressIdWithCart: previousOpenSession?.state.selectedAddressId ?? null,
      },
      toolCaller,
    );

    const saved = await createInstamartSessionWithSupersede({
      userId: user.id,
      state: workflowState,
      previousSessionId: previousOpenSession?.id,
      previousSessionState: previousOpenSession?.state,
    });

    return NextResponse.json({
      sessionId: saved.id,
      providerKey: INSTAMART_PROVIDER_KEY,
      status: workflowState.status,
      stage: workflowState.stage,
      selectedAddressId: workflowState.selectedAddressId,
      draftCartPlan: workflowState.draftCartPlan,
      availablePaymentMethods: workflowState.availablePaymentMethods,
      approvalRequired: workflowState.approvalRequired,
      summary: workflowState.summary,
    });
  } catch (error) {
    if (error instanceof SwiggyReauthorizeRequiredError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "REAUTHORIZE_REQUIRED",
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start Instamart workflow.",
      },
      { status: 500 },
    );
  }
}
