import { describe, expect, it } from "vitest";
import {
  overPlanFeatures,
  resolvePlan,
  tierForLookupKey,
  PLAN_LIMITS,
  type PlanUsage,
} from "./plans";

const future = new Date(Date.now() + 5 * 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe("resolvePlan", () => {
  it("complimentary gets business-level limits", () => {
    const p = resolvePlan({ plan: "complimentary", planStatus: null, trialEndsAt: null });
    expect(p.tier).toBe("business");
    expect(p.isComplimentary).toBe(true);
    expect(p.limits.maxMembers).toBe(Infinity);
  });

  it("active paid plans get their tier", () => {
    expect(
      resolvePlan({ plan: "team", planStatus: "active", trialEndsAt: null }).tier,
    ).toBe("team");
    expect(
      resolvePlan({ plan: "business", planStatus: "past_due", trialEndsAt: null }).tier,
    ).toBe("business");
  });

  it("a dead subscription falls back to trial/free", () => {
    const p = resolvePlan({ plan: "team", planStatus: "canceled", trialEndsAt: past });
    expect(p.tier).toBe("free");
  });

  it("live trial grants team features with a countdown", () => {
    const p = resolvePlan({ plan: "free", planStatus: null, trialEndsAt: future });
    expect(p.tier).toBe("team");
    expect(p.isTrial).toBe(true);
    expect(p.trialDaysLeft).toBeGreaterThan(0);
    expect(p.limits.ai).toBe(true);
  });

  it("expired trial means free limits", () => {
    const p = resolvePlan({ plan: "free", planStatus: null, trialEndsAt: past });
    expect(p.tier).toBe("free");
    expect(p.isTrial).toBe(false);
    expect(p.limits.maxMembers).toBe(PLAN_LIMITS.free.maxMembers);
    expect(p.limits.ai).toBe(false);
  });

  it("permanent complimentary (no end date) stays business", () => {
    const p = resolvePlan({
      plan: "complimentary",
      planStatus: null,
      trialEndsAt: null,
      complimentaryUntil: null,
    });
    expect(p.tier).toBe("business");
    expect(p.isComplimentary).toBe(true);
  });

  it("time-limited complimentary is live until its end date", () => {
    const p = resolvePlan({
      plan: "complimentary",
      planStatus: null,
      trialEndsAt: null,
      complimentaryUntil: future,
    });
    expect(p.tier).toBe("business");
    expect(p.isComplimentary).toBe(true);
    expect(p.limits.nestedTeams).toBe(true);
  });

  it("expired complimentary reverts to free", () => {
    const p = resolvePlan({
      plan: "complimentary",
      planStatus: null,
      trialEndsAt: null,
      complimentaryUntil: past,
    });
    expect(p.tier).toBe("free");
    expect(p.isComplimentary).toBe(false);
  });
});

describe("tierForLookupKey", () => {
  it("maps lookup keys to tiers", () => {
    expect(tierForLookupKey("roundup_team_monthly")).toBe("team");
    expect(tierForLookupKey("roundup_business_annual")).toBe("business");
    expect(tierForLookupKey("something_else")).toBeNull();
  });
});

describe("overPlanFeatures (grandfathering notice)", () => {
  const usage = (p: Partial<PlanUsage> = {}): PlanUsage => ({
    members: 1,
    templates: 1,
    subTeams: 0,
    nonWeeklyTeams: 0,
    ...p,
  });

  it("says nothing when everything fits", () => {
    expect(overPlanFeatures(PLAN_LIMITS.free, usage())).toEqual([]);
    expect(
      overPlanFeatures(PLAN_LIMITS.business, usage({ members: 500, subTeams: 20 })),
    ).toEqual([]);
  });

  it("flags an over-limit member and template count", () => {
    const over = overPlanFeatures(
      PLAN_LIMITS.free,
      usage({ members: 40, templates: 12 }),
    );
    expect(over.join(" ")).toContain("40 members");
    expect(over.join(" ")).toContain("12 reports");
  });

  it("flags sub-teams and non-weekly cadences below Business", () => {
    const over = overPlanFeatures(
      PLAN_LIMITS.team,
      usage({ subTeams: 3, nonWeeklyTeams: 2 }),
    );
    expect(over.join(" ")).toContain("3 sub-teams");
    expect(over.join(" ")).toContain("monthly or quarterly");
  });

  it("never flags unlimited limits as exceeded", () => {
    // Business has Infinity members/templates.
    expect(
      overPlanFeatures(PLAN_LIMITS.business, usage({ members: 99999, templates: 500 })),
    ).toEqual([]);
  });

  it("singularises a single sub-team", () => {
    const over = overPlanFeatures(PLAN_LIMITS.free, usage({ subTeams: 1 }));
    expect(over.join(" ")).toContain("1 sub-team (");
  });
});
