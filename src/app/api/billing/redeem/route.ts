import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  complimentaryCodes,
  complimentaryRedemptions,
  organisations,
} from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { resolvePlan } from "@/lib/plans";
import { addMonthsClamped } from "@/lib/dates";
import { rateLimit, retryAfterSeconds } from "@/lib/rate-limit";
import { stripe, stripeConfigured } from "@/lib/stripe";

// POST /api/billing/redeem  { code: string }
// Admin-only. One box for two kinds of code:
//   • a COMPLIMENTARY code (Roundup-internal) → grants the org time-limited
//     complimentary access immediately.
//   • a Stripe DISCOUNT (promotion) code → validated and echoed back so the
//     billing card can pre-apply it at checkout.
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) {
    return NextResponse.json({ error: "Enter a code" }, { status: 400 });
  }

  // Codes are short and human-memorable, so this endpoint is guessable at
  // volume. Cap attempts per org — generous for anyone typing a real code,
  // useless for enumeration.
  const limit = await rateLimit(`redeem:org:${me.orgId}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts — try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds(limit)) },
      },
    );
  }

  const org = (
    await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, me.orgId))
      .limit(1)
  )[0];
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = resolvePlan(org);

  // Complimentary access can't be STACKED. Without this an org could redeem
  // the same (or another) code repeatedly — each claim extends from the current
  // end date — and grant itself years of free Business access. One live grant
  // at a time; come back when it lapses.
  if (plan.isComplimentary) {
    return NextResponse.json({
      kind: "complimentary",
      permanent: org.complimentaryUntil === null,
      until: org.complimentaryUntil?.toISOString() ?? null,
      message:
        org.complimentaryUntil === null
          ? "This organisation already has complimentary access."
          : `Complimentary access already runs to ${org.complimentaryUntil.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — codes can't be stacked.`,
    });
  }

  // Don't hand free access to someone Stripe is still billing: the plan column
  // would flip to 'complimentary' while the subscription kept charging them,
  // and the next webhook would wipe the grant anyway. Have them cancel first.
  if (
    (org.plan === "team" || org.plan === "business") &&
    org.planStatus &&
    !["canceled", "unpaid", "incomplete_expired"].includes(org.planStatus)
  ) {
    return NextResponse.json(
      {
        error:
          "You have an active subscription. Cancel it under “Manage billing & invoices” first, then redeem this code — or contact us and we'll switch you over.",
      },
      { status: 409 },
    );
  }

  // ── Complimentary code? ──
  // Three steps, because the HTTP driver has no interactive transactions:
  //   1. claim a use of the code (single guarded UPDATE — race-safe: a
  //      concurrent claim blocks on the row and re-checks max_redemptions)
  //   2. record the redemption; UNIQUE(code_id, org_id) is what stops the same
  //      org redeeming this code again, and is the audit trail
  //   3. grant the access
  // If (2) says this org already used the code we hand the claim back, so a
  // refused redemption doesn't silently consume someone else's allocation.
  const claimed = await db
    .update(complimentaryCodes)
    .set({ timesRedeemed: sql`${complimentaryCodes.timesRedeemed} + 1` })
    .where(
      and(
        eq(complimentaryCodes.code, code),
        eq(complimentaryCodes.active, true),
        sql`(${complimentaryCodes.expiresAt} IS NULL OR ${complimentaryCodes.expiresAt} > now())`,
        sql`(${complimentaryCodes.maxRedemptions} IS NULL OR ${complimentaryCodes.timesRedeemed} < ${complimentaryCodes.maxRedemptions})`,
      ),
    )
    .returning({ id: complimentaryCodes.id, months: complimentaryCodes.months });

  if (claimed.length > 0) {
    const { id: codeId, months } = claimed[0];
    // Stacking is refused above, so the grant always starts now.
    const until = addMonthsClamped(new Date(), months);

    const recorded = await db
      .insert(complimentaryRedemptions)
      .values({
        codeId,
        orgId: org.id,
        userId: me.id,
        months,
        grantedUntil: until,
      })
      .onConflictDoNothing()
      .returning({ id: complimentaryRedemptions.id });

    if (recorded.length === 0) {
      // Already redeemed by this org — return the use we just claimed.
      await db
        .update(complimentaryCodes)
        .set({ timesRedeemed: sql`GREATEST(${complimentaryCodes.timesRedeemed} - 1, 0)` })
        .where(eq(complimentaryCodes.id, codeId));
      return NextResponse.json(
        { error: "This organisation has already redeemed that code." },
        { status: 409 },
      );
    }

    await db
      .update(organisations)
      .set({ plan: "complimentary", planStatus: null, complimentaryUntil: until })
      .where(eq(organisations.id, org.id));

    return NextResponse.json({
      kind: "complimentary",
      months,
      until: until.toISOString(),
      message: `Complimentary access unlocked for ${months} month${months === 1 ? "" : "s"}.`,
    });
  }

  // A code that exists but couldn't be claimed (spent / expired / inactive) is
  // reported with the SAME message as one that doesn't exist — distinguishing
  // them turns this endpoint into an oracle for enumerating real codes.
  const existsComp = (
    await db
      .select({ id: complimentaryCodes.id })
      .from(complimentaryCodes)
      .where(eq(complimentaryCodes.code, code))
      .limit(1)
  )[0];
  if (existsComp) {
    return NextResponse.json(
      { error: "That code isn't valid." },
      { status: 400 },
    );
  }

  // ── Otherwise, a Stripe discount (promotion) code? Validate and hand it back
  //    for the billing card to apply at checkout. ──
  if (stripeConfigured()) {
    try {
      const promos = await stripe().promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });
      if (promos.data.length > 0) {
        return NextResponse.json({
          kind: "discount",
          code: promos.data[0].code,
          message: "Discount applied — it'll come off at checkout.",
        });
      }
    } catch {
      /* fall through to the generic invalid-code response */
    }
  }

  return NextResponse.json(
    { error: "That code isn't valid." },
    { status: 400 },
  );
}
