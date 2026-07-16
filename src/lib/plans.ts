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

export function resolvePlan(org: {
  plan: string;
  planStatus: string | null;
  trialEndsAt: Date | null;
}): ResolvedPlan {
  const base = {
    paidPlan: org.plan,
    isComplimentary: org.plan === "complimentary",
    isTrial: false,
    trialDaysLeft: 0,
  };

  if (org.plan === "complimentary") {
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
