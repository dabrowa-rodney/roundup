import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organisations } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { appUrl } from "@/lib/email";

// POST /api/billing/portal — Stripe Customer Portal (invoices, card, cancel,
// plan changes). Admin-only; requires an existing Stripe customer.
export async function POST() {
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

  const org = (
    await db
      .select({ stripeCustomerId: organisations.stripeCustomerId })
      .from(organisations)
      .where(eq(organisations.id, me.orgId))
      .limit(1)
  )[0];
  if (!org?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet — subscribe first" },
      { status: 400 },
    );
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: appUrl("/settings"),
  });
  return NextResponse.json({ url: session.url });
}
