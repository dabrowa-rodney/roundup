import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organisations } from "@/db/schema";
import { tierForLookupKey } from "@/lib/plans";
import { stripe } from "@/lib/stripe";

// POST /api/stripe/webhook — keeps organisations.plan/planStatus in sync with
// Stripe. Registered (and its secret minted) by scripts/stripe-setup.mjs.
// Subscribed events: customer.subscription.created/updated/deleted.

async function orgIdForSubscription(sub: Stripe.Subscription): Promise<number | null> {
  const fromMeta = parseInt(sub.metadata?.orgId ?? "", 10);
  if (!isNaN(fromMeta)) return fromMeta;
  // Fallback: match by customer id.
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const row = (
    await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(eq(organisations.stripeCustomerId, customerId))
      .limit(1)
  )[0];
  return row?.id ?? null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await req.text();
    event = await stripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = await orgIdForSubscription(sub);
      if (orgId === null) break;

      const lookupKey = sub.items.data[0]?.price?.lookup_key ?? "";
      const tier = tierForLookupKey(lookupKey);
      if (!tier) break;

      // A dead subscription reverts the org to free (deleted handles the
      // final transition, but 'unpaid'/'incomplete_expired' land here too).
      const dead = ["canceled", "unpaid", "incomplete_expired"].includes(sub.status);
      await db
        .update(organisations)
        .set(
          dead
            ? { plan: "free", planStatus: null }
            : { plan: tier, planStatus: sub.status },
        )
        .where(eq(organisations.id, orgId));
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = await orgIdForSubscription(sub);
      if (orgId === null) break;
      await db
        .update(organisations)
        .set({ plan: "free", planStatus: null })
        .where(eq(organisations.id, orgId));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
