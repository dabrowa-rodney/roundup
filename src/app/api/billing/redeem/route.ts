import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { complimentaryCodes, organisations } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
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

  const org = (
    await db
      .select({
        id: organisations.id,
        plan: organisations.plan,
        complimentaryUntil: organisations.complimentaryUntil,
      })
      .from(organisations)
      .where(eq(organisations.id, me.orgId))
      .limit(1)
  )[0];
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // A permanent (console-granted) complimentary org needs no codes.
  if (org.plan === "complimentary" && org.complimentaryUntil === null) {
    return NextResponse.json({
      kind: "complimentary",
      permanent: true,
      message: "This organisation already has complimentary access.",
    });
  }

  // ── Complimentary code? Claim it race-safely (active, not expired, uses
  //    remaining), all in one guarded UPDATE. ──
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
    .returning({ months: complimentaryCodes.months });

  if (claimed.length > 0) {
    const months = claimed[0].months;
    // Extend from the later of now / an existing future grant.
    const base =
      org.plan === "complimentary" &&
      org.complimentaryUntil &&
      org.complimentaryUntil.getTime() > Date.now()
        ? new Date(org.complimentaryUntil)
        : new Date();
    const until = new Date(base);
    until.setUTCMonth(until.getUTCMonth() + months);

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

  // A complimentary code that exists but couldn't be claimed is spent/expired/
  // inactive — say so rather than falling through to "invalid".
  const existsComp = (
    await db
      .select({ id: complimentaryCodes.id })
      .from(complimentaryCodes)
      .where(eq(complimentaryCodes.code, code))
      .limit(1)
  )[0];
  if (existsComp) {
    return NextResponse.json(
      { error: "That code is no longer available (expired or fully redeemed)." },
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
