import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { db } from "@/db";
import { organisations, settings } from "@/db/schema";
import { slugProblem } from "@/lib/org";

const SETTINGS_FIELDS = [
  "closeDay", "closeTime", "openDay", "openTime", "timezone",
  "reminder1Enabled", "reminder1Day", "reminder1Time",
  "reminder2Enabled", "reminder2Day", "reminder2Time",
  "reminderRoundupReady",
] as const;

// PATCH /api/console/orgs/[id] — platform-owner edits to any organisation:
//   { name?, slug?, clearAnthropicKey?: true, settings?: {closeDay, ...} }
// The owner can see whether an AI key exists and remove a broken one, but
// can never read or set key material on a tenant's behalf.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const orgId = parseInt(id, 10);
  if (isNaN(orgId)) {
    return NextResponse.json({ error: "Invalid org ID" }, { status: 400 });
  }
  const org = (
    await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1)
  )[0];
  if (!org) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const orgUpdates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 60) {
      return NextResponse.json(
        { error: "Organisation name must be 2–60 characters" },
        { status: 400 },
      );
    }
    orgUpdates.name = name;
  }

  if (body.slug !== undefined) {
    const slug =
      typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const problem = slugProblem(slug);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const taken = await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(eq(organisations.slug, slug))
      .limit(1);
    if (taken.length > 0 && taken[0].id !== orgId) {
      return NextResponse.json(
        { error: "That workspace URL is taken" },
        { status: 409 },
      );
    }
    orgUpdates.slug = slug;
  }

  if (body.clearAnthropicKey === true) {
    orgUpdates.anthropicKeyEnc = null;
  }

  if (Object.keys(orgUpdates).length > 0) {
    await db
      .update(organisations)
      .set(orgUpdates)
      .where(eq(organisations.id, orgId));
  }

  if (body.settings && typeof body.settings === "object") {
    const settingsUpdates: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of SETTINGS_FIELDS) {
      if (body.settings[f] !== undefined) settingsUpdates[f] = body.settings[f];
    }
    if (Object.keys(settingsUpdates).length > 1) {
      const existing = await db
        .select({ id: settings.id })
        .from(settings)
        .where(eq(settings.orgId, orgId))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(settings).values({ ...settingsUpdates, orgId });
      } else {
        await db
          .update(settings)
          .set(settingsUpdates)
          .where(eq(settings.id, existing[0].id));
      }
    }
  }

  return NextResponse.json({ ok: true });
}
