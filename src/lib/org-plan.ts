// DB-backed plan resolution (the pure logic lives in lib/plans.ts).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organisations } from "@/db/schema";
import { resolvePlan, type ResolvedPlan } from "./plans";

export async function getOrgPlan(orgId: number): Promise<ResolvedPlan> {
  const org = (
    await db
      .select({
        plan: organisations.plan,
        planStatus: organisations.planStatus,
        trialEndsAt: organisations.trialEndsAt,
      })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1)
  )[0];
  return resolvePlan(
    org ?? { plan: "free", planStatus: null, trialEndsAt: null },
  );
}
