import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";
import { DAY_NAMES, isValidTimeZone } from "@/lib/lifecycle";

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

  const DAY_FIELDS = ["closeDay", "openDay", "reminder1Day", "reminder2Day"];
  const TIME_FIELDS = ["closeTime", "openTime", "reminder1Time", "reminder2Time"];
  const BOOL_FIELDS = [
    "reminder1Enabled",
    "reminder2Enabled",
    "reminderRoundupReady",
  ];
  const allowedFields = [
    ...DAY_FIELDS,
    ...TIME_FIELDS,
    ...BOOL_FIELDS,
    "timezone",
  ];

  // These values are fed to Intl/date maths by the schedule helpers and the
  // nightly crons, which iterate EVERY org — an unvalidated value here (e.g.
  // a bogus timezone, which makes Intl.DateTimeFormat throw) would break the
  // shared job for every other organisation too. Validate strictly.
  for (const field of allowedFields) {
    if (body[field] === undefined) continue;
    const v = body[field];

    if (DAY_FIELDS.includes(field)) {
      if (!DAY_NAMES.includes(v)) {
        return NextResponse.json(
          { error: `${field} must be a day name (e.g. "Monday")` },
          { status: 400 },
        );
      }
    } else if (TIME_FIELDS.includes(field)) {
      if (typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) {
        return NextResponse.json(
          { error: `${field} must be a 24-hour time (e.g. "20:00")` },
          { status: 400 },
        );
      }
    } else if (BOOL_FIELDS.includes(field)) {
      if (typeof v !== "boolean") {
        return NextResponse.json(
          { error: `${field} must be true or false` },
          { status: 400 },
        );
      }
    } else if (field === "timezone") {
      if (typeof v !== "string" || !isValidTimeZone(v)) {
        return NextResponse.json(
          { error: "That isn't a recognised timezone (e.g. \"Europe/London\")" },
          { status: 400 },
        );
      }
    }
    updates[field] = v;
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
