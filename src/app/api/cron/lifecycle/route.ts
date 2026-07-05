import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  organisations,
  reportAssignees,
  reportInstances,
  reportTemplates,
  settings,
} from "@/db/schema";
import { mondayISO } from "@/lib/dates";
import {
  isWeekClosed,
  reopenInstant,
  type ScheduleSettings,
} from "@/lib/lifecycle";
import { getSessionUser } from "@/lib/session";

export const maxDuration = 60;

const DEFAULT_SCHEDULE: ScheduleSettings = {
  closeDay: "Sunday",
  closeTime: "20:00",
  openDay: "Monday",
  openTime: "01:00",
  timezone: "Europe/London",
};

/** Which orgs the caller may run the job for: all (cron) or their own (admin). */
async function authorisedOrgIds(req: NextRequest): Promise<number[] | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) {
    const orgs = await db.select({ id: organisations.id }).from(organisations);
    return orgs.map((o) => o.id);
  }
  // Allow an org admin to trigger it manually for their own org.
  const me = await getSessionUser();
  if (me?.role === "admin") return [me.orgId];
  return null;
}

function toSchedule(row: typeof settings.$inferSelect | undefined): ScheduleSettings {
  return row
    ? {
        closeDay: row.closeDay,
        closeTime: row.closeTime,
        openDay: row.openDay,
        openTime: row.openTime,
        timezone: row.timezone,
      }
    : DEFAULT_SCHEDULE;
}

// GET /api/cron/lifecycle — for every organisation: lock weeks past their
// close, open the current week for all active assignees.
export async function GET(req: NextRequest) {
  const orgIds = await authorisedOrgIds(req);
  if (!orgIds) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekIso = mondayISO(now);
  let locked = 0;
  let created = 0;

  for (const orgId of orgIds) {
    const row = (
      await db.select().from(settings).where(eq(settings.orgId, orgId)).limit(1)
    )[0];
    const sched = toSchedule(row);

    // 1) Lock every not-yet-locked week whose close time has passed.
    const openWeeks = await db
      .selectDistinct({ weekStart: reportInstances.weekStart })
      .from(reportInstances)
      .where(
        and(
          eq(reportInstances.orgId, orgId),
          ne(reportInstances.status, "locked"),
        ),
      );

    for (const w of openWeeks) {
      if (isWeekClosed(w.weekStart, sched, now)) {
        const updated = await db
          .update(reportInstances)
          .set({ status: "locked", updatedAt: now })
          .where(
            and(
              eq(reportInstances.orgId, orgId),
              eq(reportInstances.weekStart, w.weekStart),
              ne(reportInstances.status, "locked"),
            ),
          )
          .returning({ id: reportInstances.id });
        locked += updated.length;
      }
    }

    // 2) Open the current week (once its reopen time has passed): ensure an
    //    empty instance exists for every active assignee.
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
        .where(
          and(
            eq(reportTemplates.orgId, orgId),
            isNull(reportTemplates.archivedAt),
          ),
        );

      if (assignees.length > 0) {
        const inserted = await db
          .insert(reportInstances)
          .values(
            assignees.map((a) => ({
              orgId,
              templateId: a.templateId,
              userId: a.userId,
              weekStart: weekIso,
              status: "not_started",
              openedAt: now,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: reportInstances.id });
        created += inserted.length;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    week: weekIso,
    orgs: orgIds.length,
    locked,
    created,
  });
}
