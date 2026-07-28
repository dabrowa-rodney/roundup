import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organisations } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { PRICE_LOOKUP_KEYS, resolvePlan, type PriceKey } from "@/lib/plans";
import {
  getOrCreateCustomerId,
  priceIdForLookupKey,
  stripe,
  stripeConfigured,
} from "@/lib/stripe";
import { appUrl } from "@/lib/email";

// POST /api/billing/checkout  { price: "team_monthly" | "team_annual" | ... }
// Admin-only. Returns a Stripe Checkout URL for a subscription; promotion
// codes (the console-issued discount codes) can be entered on the Stripe page.
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't configured yet" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const key = body.price as PriceKey;
  if (!PRICE_LOOKUP_KEYS[key]) {
    return NextResponse.json({ error: "Unknown price" }, { status: 400 });
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
  // Only block checkout while complimentary access is actually LIVE — an
  // expired time-limited grant must be able to subscribe (resolvePlan, not the
  // raw plan column, which still reads 'complimentary' until the cron tidies it).
  if (resolvePlan(org).isComplimentary) {
    return NextResponse.json(
      { error: "This organisation has complimentary access" },
      { status: 400 },
    );
  }

  const priceId = await priceIdForLookupKey(PRICE_LOOKUP_KEYS[key]);
  if (!priceId) {
    return NextResponse.json(
      { error: "Price not found — run the Stripe setup script" },
      { status: 500 },
    );
  }

  // An optional discount code entered on the billing card (validated by the
  // redeem endpoint). Resolve it to a promotion-code id and pre-apply it;
  // Stripe forbids `discounts` and `allow_promotion_codes` together, so a
  // pre-applied code replaces the "enter a code" box on the Stripe page.
  let discounts: { promotion_code: string }[] | undefined;
  const promoCode =
    typeof body.promoCode === "string" ? body.promoCode.trim() : "";
  if (promoCode) {
    try {
      const found = await stripe().promotionCodes.list({
        code: promoCode.toUpperCase(),
        active: true,
        limit: 1,
      });
      if (found.data.length > 0) {
        discounts = [{ promotion_code: found.data[0].id }];
      }
    } catch {
      /* ignore a bad code — fall back to the enter-at-checkout box */
    }
  }

  const customerId = await getOrCreateCustomerId(org);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Pre-applied discount, or the manual "enter a code" box when there's none.
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    subscription_data: { metadata: { orgId: String(org.id) } },
    metadata: { orgId: String(org.id) },
    success_url: appUrl("/settings?billing=success"),
    cancel_url: appUrl("/settings?billing=cancelled"),
  });

  return NextResponse.json({ url: session.url });
}
