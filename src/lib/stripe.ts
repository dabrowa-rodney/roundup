// Stripe client + org helpers. Everything degrades gracefully when
// STRIPE_SECRET_KEY isn't set (billing UI shows "not configured"), matching
// the RESEND/Anthropic key patterns.

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organisations } from "@/db/schema";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

/** The org's Stripe customer, created on first use. */
export async function getOrCreateCustomerId(org: {
  id: number;
  name: string;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const customer = await stripe().customers.create({
    name: org.name,
    metadata: { orgId: String(org.id) },
  });
  await db
    .update(organisations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organisations.id, org.id));
  return customer.id;
}

/** Look a price up by its lookup key (set by scripts/stripe-setup.mjs). */
export async function priceIdForLookupKey(lookupKey: string): Promise<string | null> {
  const prices = await stripe().prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  return prices.data[0]?.id ?? null;
}
