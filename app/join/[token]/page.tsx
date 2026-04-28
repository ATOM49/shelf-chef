import { JoinHouseholdClient } from "@/components/households/JoinHouseholdClient";
import { requireUser } from "@/src/lib/auth/session";

export default async function JoinHouseholdPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await requireUser({ callbackUrl: `/join/${token}` });
  return <JoinHouseholdClient token={token} />;
}
