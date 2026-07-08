import { describe, expect, it } from "vitest";
import { resolvePlan, tierForLookupKey, PLAN_LIMITS } from "./plans";

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
});

describe("tierForLookupKey", () => {
  it("maps lookup keys to tiers", () => {
    expect(tierForLookupKey("roundup_team_monthly")).toBe("team");
    expect(tierForLookupKey("roundup_business_annual")).toBe("business");
    expect(tierForLookupKey("something_else")).toBeNull();
  });
});
