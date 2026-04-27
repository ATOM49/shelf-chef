import { FoodPlannerAppClient } from "@/components/app/FoodPlannerAppClient";
import { requireUser } from "@/src/lib/auth/session";

export default async function Home() {
  await requireUser({ callbackUrl: "/" });
  return <FoodPlannerAppClient />;
}
