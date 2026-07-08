// One-time Stripe bootstrap: products, multi-currency prices (GBP + USD) and
// the webhook endpoint. Idempotent — safe to re-run; it skips anything that
// already exists (matched by price lookup_key / webhook URL).
//
//   STRIPE_SECRET_KEY=sk_... node scripts/stripe-setup.mjs
//
// Prints STRIPE_WEBHOOK_SECRET when it creates the webhook endpoint —
// add that to Vercel + .env.local.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first");
  process.exit(1);
}
const stripe = new Stripe(key);
const WEBHOOK_URL = "https://www.roundup.work/api/stripe/webhook";

// unit_amount is the GBP default; currency_options adds USD so Stripe
// auto-presents the right currency at checkout.
const PLANS = [
  {
    product: { name: "Roundup Team", key: "roundup_team" },
    prices: [
      { lookup: "roundup_team_monthly", interval: "month", gbp: 2900, usd: 3900 },
      { lookup: "roundup_team_annual", interval: "year", gbp: 29000, usd: 39000 },
    ],
  },
  {
    product: { name: "Roundup Business", key: "roundup_business" },
    prices: [
      { lookup: "roundup_business_monthly", interval: "month", gbp: 7900, usd: 9900 },
      { lookup: "roundup_business_annual", interval: "year", gbp: 79000, usd: 99000 },
    ],
  },
];

async function ensureProduct(def) {
  const existing = await stripe.products.search({
    query: `metadata["key"]:"${def.key}" AND active:"true"`,
  });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({ name: def.name, metadata: { key: def.key } });
}

async function ensurePrice(productId, def) {
  const existing = await stripe.prices.list({
    lookup_keys: [def.lookup],
    active: true,
    limit: 1,
  });
  if (existing.data[0]) {
    console.log(`price ${def.lookup}: exists (${existing.data[0].id})`);
    return;
  }
  const price = await stripe.prices.create({
    product: productId,
    lookup_key: def.lookup,
    currency: "gbp",
    unit_amount: def.gbp,
    recurring: { interval: def.interval },
    currency_options: { usd: { unit_amount: def.usd } },
  });
  console.log(`price ${def.lookup}: created (${price.id})`);
}

async function ensureWebhook() {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((e) => e.url === WEBHOOK_URL);
  if (existing) {
    console.log(`webhook: exists (${existing.id}) — secret only shown at creation`);
    return;
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ],
  });
  console.log(`webhook: created (${endpoint.id})`);
  console.log(`\nSTRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`);
}

for (const plan of PLANS) {
  const product = await ensureProduct(plan.product);
  console.log(`product ${plan.product.name}: ${product.id}`);
  for (const price of plan.prices) await ensurePrice(product.id, price);
}
await ensureWebhook();
console.log("Stripe setup complete.");
