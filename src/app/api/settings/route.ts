import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";

// GET /api/settings — the caller's org's settings
export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.orgId, me.orgId))
    .limit(1);

  if (rows.length === 0) {
    // Return defaults if no settings row exists yet
    return NextResponse.json({
      settings: {
        closeDay: "Sunday",
        closeTime: "20:00",
        openDay: "Monday",
        openTime: "01:00",
        timezone: "Europe/London",
        reminder1Enabled: true,
        reminder1Day: "Thursday",
        reminder1Time: "13:00",
        reminder2Enabled: true,
        reminder2Day: "Friday",
        reminder2Time: "09:00",
        reminderRoundupReady: false,
      },
    });
  }

  return NextResponse.json({ settings: rows[0] });
}

// PATCH /api/settings — update the caller's org's settings
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  const allowedFields = [
    "closeDay", "closeTime", "openDay", "openTime", "timezone",
    "reminder1Enabled", "reminder1Day", "reminder1Time",
    "reminder2Enabled", "reminder2Day", "reminder2Time",
    "reminderRoundupReady",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Upsert the org's row — create if it doesn't exist, update if it does
  const existing = await db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.orgId, me.orgId))
    .limit(1);

  let result;
  if (existing.length === 0) {
    result = await db
      .insert(settings)
      .values({ ...updates, orgId: me.orgId })
      .returning();
  } else {
    result = await db
      .update(settings)
      .set(updates)
      .where(eq(settings.id, existing[0].id))
      .returning();
  }

  return NextResponse.json({ settings: result[0] });
}
