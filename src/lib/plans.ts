// Subscription tiers and feature gates. The org's `plan` column is what
// Stripe (or the owner console) says they pay for; `resolvePlan` turns that
// plus the trial clock into the EFFECTIVE tier the app enforces.
//
// Gates are applied at the chokepoints: member invites, template creation,
// AI generation, and sub-team creation. Everything else works on every tier.

export type Tier = "free" | "team" | "business";

export interface PlanLimits {
  label: string;
  maxMembers: number; // Infinity = unlimited
  maxTemplates: number;
  ai: boolean;
  // Nested teams (sub-teams + monthly/quarterly cadences) are a Business
  // feature (D5). Free/Team orgs stay a single root team.
  nestedTeams: boolean;
}

export const PLAN_LIMITS: Record<Tier, PlanLimits> = {
  free: {
    label: "Free",
    maxMembers: 3,
    maxTemplates: 1,
    ai: false,
    nestedTeams: false,
  },
  team: {
    label: "Team",
    maxMembers: 25,
    maxTemplates: Infinity,
    ai: true,
    nestedTeams: false,
  },
  business: {
    label: "Business",
    maxMembers: Infinity,
    maxTemplates: Infinity,
    ai: true,
    nestedTeams: true,
  },
};

// Price lookup keys as created by scripts/stripe-setup.mjs. Each price is
// multi-currency (GBP default, USD option) so one key serves both.
export const PRICE_LOOKUP_KEYS = {
  team_monthly: "roundup_team_monthly",
  team_annual: "roundup_team_annual",
  business_monthly: "roundup_business_monthly",
  business_annual: "roundup_business_annual",
} as const;
export type PriceKey = keyof typeof PRICE_LOOKUP_KEYS;

export function tierForLookupKey(lookupKey: string): Tier | null {
  if (lookupKey.startsWith("roundup_team_")) return "team";
  if (lookupKey.startsWith("roundup_business_")) return "business";
  return null;
}

// Subscription statuses that grant the paid tier's features.
const GOOD_STANDING = new Set(["active", "trialing", "past_due"]);

export interface ResolvedPlan {
  tier: Tier; // the effective tier to enforce
  limits: PlanLimits;
  paidPlan: string; // raw plan column
  isComplimentary: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
}

/** What an org is actually using, for the over-plan check below. */
export interface PlanUsage {
  members: number;
  templates: number;
  subTeams: number; // teams below the root
  nonWeeklyTeams: number; // monthly/quarterly cadences
}

/**
 * GRANDFATHERING POLICY (deliberate, see docs/ARCHITECTURE.md)
 *
 * Limits are enforced when something is CREATED — inviting a member, adding a
 * template, creating a sub-team, switching cadence. What already exists is
 * never taken away or switched off when a plan lapses: tearing down a
 * customer's live reporting structure mid-week would lose real work, and the
 * cheapest moment to say no is at creation.
 *
 * The cost is that a lapsed org can sit above its plan indefinitely, so the
 * rule is: grandfather it, but SAY SO. This returns the human-readable list of
 * what's over the current plan, which the billing card surfaces.
 */
export function overPlanFeatures(limits: PlanLimits, usage: PlanUsage): string[] {
  const over: string[] = [];
  if (Number.isFinite(limits.maxMembers) && usage.members > limits.maxMembers) {
    over.push(
      `${usage.members} members (${limits.label} includes ${limits.maxMembers})`,
    );
  }
  if (
    Number.isFinite(limits.maxTemplates) &&
    usage.templates > limits.maxTemplates
  ) {
    over.push(
      `${usage.templates} reports (${limits.label} includes ${limits.maxTemplates})`,
    );
  }
  if (!limits.nestedTeams && usage.subTeams > 0) {
    over.push(
      `${usage.subTeams} sub-team${usage.subTeams === 1 ? "" : "s"} (a Business feature)`,
    );
  }
  if (!limits.nestedTeams && usage.nonWeeklyTeams > 0) {
    over.push(
      `${usage.nonWeeklyTeams} team${usage.nonWeeklyTeams === 1 ? "" : "s"} on a monthly or quarterly cadence (a Business feature)`,
    );
  }
  return over;
}

export function resolvePlan(org: {
  plan: string;
  planStatus: string | null;
  trialEndsAt: Date | null;
  complimentaryUntil?: Date | null;
}): ResolvedPlan {
  // A complimentary grant is live when the plan is 'complimentary' AND either
  // it's permanent (complimentaryUntil null — an owner console grant) or its
  // end date is still in the future (a time-limited redeemed code). An expired
  // grant falls through to the normal free/trial logic below.
  const compLive =
    org.plan === "complimentary" &&
    (org.complimentaryUntil == null ||
      org.complimentaryUntil.getTime() > Date.now());

  const base = {
    paidPlan: org.plan,
    isComplimentary: compLive,
    isTrial: false,
    trialDaysLeft: 0,
  };

  if (compLive) {
    return { ...base, tier: "business", limits: PLAN_LIMITS.business };
  }
  if (
    (org.plan === "team" || org.plan === "business") &&
    GOOD_STANDING.has(org.planStatus ?? "")
  ) {
    const tier = org.plan as Tier;
    return { ...base, tier, limits: PLAN_LIMITS[tier] };
  }
  // Card-free signup trial: Team features until the clock runs out.
  if (org.trialEndsAt && org.trialEndsAt.getTime() > Date.now()) {
    const days = Math.ceil(
      (org.trialEndsAt.getTime() - Date.now()) / 86_400_000,
    );
    return {
      ...base,
      tier: "team",
      limits: PLAN_LIMITS.team,
      isTrial: true,
      trialDaysLeft: days,
    };
  }
  return { ...base, tier: "free", limits: PLAN_LIMITS.free };
}
