import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organisations } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { slugProblem } from "@/lib/org";
import { resolvePlan } from "@/lib/plans";
import { getSessionUser } from "@/lib/session";
import { stripeConfigured } from "@/lib/stripe";

// GET /api/org — the caller's organisation (never returns the stored key).
export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  return NextResponse.json({
    org: {
      name: org.name,
      slug: org.slug,
      hasAnthropicKey: !!org.anthropicKeyEnc,
      billing: {
        tier: plan.tier,
        label: plan.limits.label,
        paidPlan: plan.paidPlan,
        planStatus: org.planStatus,
        isComplimentary: plan.isComplimentary,
        isTrial: plan.isTrial,
        trialDaysLeft: plan.trialDaysLeft,
        hasStripeCustomer: !!org.stripeCustomerId,
        available: stripeConfigured(),
      },
    },
  });
}

// PATCH /api/org — update org name, subdomain slug and/or the Anthropic API key.
//   { name?: string, slug?: string, anthropicApiKey?: string | null }
// The key is write-only: stored encrypted, never echoed back. null clears it.
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 60) {
      return NextResponse.json(
        { error: "Organisation name must be 2–60 characters" },
        { status: 400 },
      );
    }
    updates.name = name;
  }

  if (body.slug !== undefined) {
    const slug =
      typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const problem = slugProblem(slug);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    const taken = await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(eq(organisations.slug, slug))
      .limit(1);
    if (taken.length > 0 && taken[0].id !== me.orgId) {
      return NextResponse.json(
        { error: "That workspace URL is taken — pick another" },
        { status: 409 },
      );
    }
    updates.slug = slug;
  }

  if (body.anthropicApiKey !== undefined) {
    if (body.anthropicApiKey === null || body.anthropicApiKey === "") {
      updates.anthropicKeyEnc = null;
    } else if (typeof body.anthropicApiKey === "string") {
      const key = body.anthropicApiKey.trim();
      if (!key.startsWith("sk-ant-")) {
        return NextResponse.json(
          { error: "That doesn't look like an Anthropic API key (sk-ant-…)" },
          { status: 400 },
        );
      }
      // Verify the key actually works before storing it (cheap list call).
      try {
        const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.status === 401 || res.status === 403) {
          return NextResponse.json(
            { error: "Anthropic rejected that key — check it and try again" },
            { status: 400 },
          );
        }
      } catch {
        // Network hiccup — accept the key rather than block on our outage.
      }
      updates.anthropicKeyEnc = encryptSecret(key);
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db
    .update(organisations)
    .set(updates)
    .where(eq(organisations.id, me.orgId));

  const org = (
    await db
      .select({
        name: organisations.name,
        slug: organisations.slug,
        keyEnc: organisations.anthropicKeyEnc,
      })
      .from(organisations)
      .where(eq(organisations.id, me.orgId))
      .limit(1)
  )[0];

  return NextResponse.json({
    org: { name: org.name, slug: org.slug, hasAnthropicKey: !!org.keyEnc },
  });
}
