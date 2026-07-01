import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq, isNull, ne } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  reportAssignees,
  reportInstances,
  reportTemplates,
  settings,
  users,
} from "@/db/schema";
import { mondayISO } from "@/lib/dates";
import {
  isWeekClosed,
  reopenInstant,
  type ScheduleSettings,
} from "@/lib/lifecycle";

const DEFAULT_SCHEDULE: ScheduleSettings = {
  closeDay: "Sunday",
  closeTime: "20:00",
  openDay: "Monday",
  openTime: "01:00",
  timezone: "Europe/London",
};

async function authorised(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header === `Bearer ${secret}`) return true;
  }
  // Allow an admin to trigger it manually (e.g. for testing).
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const caller = (
      await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.email, session.user.email.toLowerCase()))
        .limit(1)
    )[0];
    if (caller?.role === "admin") return true;
  }
  return false;
}

// GET /api/cron/lifecycle — lock weeks past their close, open the current week.
export async function GET(req: NextRequest) {
  if (!(await authorised(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = (await db.select().from(settings).limit(1))[0];
  const sched: ScheduleSettings = row
    ? {
        closeDay: row.closeDay,
        closeTime: row.closeTime,
        openDay: row.openDay,
        openTime: row.openTime,
        timezone: row.timezone,
      }
    : DEFAULT_SCHEDULE;

  const now = new Date();

  // 1) Lock every not-yet-locked week whose close time has passed.
  const openWeeks = await db
    .selectDistinct({ weekStart: reportInstances.weekStart })
    .from(reportInstances)
    .where(ne(reportInstances.status, "locked"));

  let locked = 0;
  for (const w of openWeeks) {
    if (isWeekClosed(w.weekStart, sched, now)) {
      const updated = await db
        .update(reportInstances)
        .set({ status: "locked", updatedAt: now })
        .where(
          and(
            eq(reportInstances.weekStart, w.weekStart),
            ne(reportInstances.status, "locked"),
          ),
        )
        .returning({ id: reportInstances.id });
      locked += updated.length;
    }
  }

  // 2) Open the current week (once its reopen time has passed): ensure an empty
  //    instance exists for every active assignee.
  const weekIso = mondayISO(now);
  let created = 0;
  if (now.getTime() >= reopenInstant(weekIso, sched).getTime()) {
    const assignees = await db
      .select({
        templateId: reportAssignees.templateId,
        userId: reportAssignees.userId,
      })
      .from(reportAssignees)
      .innerJoin(
        reportTemplates,
        eq(reportAssignees.templateId, reportTemplates.id),
      )
      .where(isNull(reportTemplates.archivedAt));

    if (assignees.length > 0) {
      const inserted = await db
        .insert(reportInstances)
        .values(
          assignees.map((a) => ({
            templateId: a.templateId,
            userId: a.userId,
            weekStart: weekIso,
            status: "not_started",
            openedAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: reportInstances.id });
      created = inserted.length;
    }
  }

  return NextResponse.json({ ok: true, week: weekIso, locked, created });
}
