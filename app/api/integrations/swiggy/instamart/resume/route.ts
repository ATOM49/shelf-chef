import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { getInstamartSessionForUser, updateInstamartSession } from "@/src/lib/instamart/session-store";
import { createInstamartToolCaller, SwiggyReauthorizeRequiredError } from "@/src/lib/instamart/mcp";
import { resumeInstamartWorkflow } from "@/src/lib/instamart/workflow";

const resumeBodySchema = z.object({
  sessionId: z.string().min(1),
  approved: z.boolean(),
  paymentMethod: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = resumeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const session = await getInstamartSessionForUser(user.id, parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Instamart workflow session not found" }, { status: 404 });
  }

  const toolCaller = createInstamartToolCaller(user.id);

  try {
    const resumed = await resumeInstamartWorkflow(
      session.state,
      {
        approved: parsed.data.approved,
        paymentMethod: parsed.data.paymentMethod,
      },
      toolCaller,
    );

    await updateInstamartSession(session.id, resumed);

    return NextResponse.json({
      sessionId: session.id,
      status: resumed.status,
      stage: resumed.stage,
      checkout: resumed.checkout,
      tracking: resumed.tracking,
      availablePaymentMethods: resumed.availablePaymentMethods,
      summary: resumed.summary,
    });
  } catch (error) {
    if (error instanceof SwiggyReauthorizeRequiredError) {
      return NextResponse.json(
        { error: error.message, code: "REAUTHORIZE_REQUIRED" },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to resume Instamart workflow.",
      },
      { status: 500 },
    );
  }
}
