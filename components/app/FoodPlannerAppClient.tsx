"use client";

import dynamic from "next/dynamic";

const FoodPlannerApp = dynamic(
  () => import("@/components/app/FoodPlannerApp").then((m) => m.FoodPlannerApp),
  { ssr: false },
);

export function FoodPlannerAppClient() {
  return <FoodPlannerApp />;
}
