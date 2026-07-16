import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  organisations,
  reportAssignees,
  reportInstances,
  reportTemplates,
  settings,
  teams,
} from "@/db/schema";
import { mondayISO, periodForCadence, periodStartISO } from "@/lib/dates";
import {
  isPeriodClosed,
  periodOpenInstant,
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

// GET /api/cron/lifecycle — for every organisation, per TEAM: lock periods
// past their close, open the current period for all active assignees. Weekly
// teams turn over weekly; monthly/quarterly teams on calendar boundaries.
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

    const teamRows = await db
      .select({ id: teams.id, cadence: teams.cadence })
      .from(teams)
      .where(and(eq(teams.orgId, orgId), isNull(teams.archivedAt)));

    for (const team of teamRows) {
      const period = periodForCadence(team.cadence);
      const periodIso = periodStartISO(period, now);

      // This team's active template ids — the unit instances hang off.
      const templateRows = await db
        .select({ id: reportTemplates.id })
        .from(reportTemplates)
        .where(
          and(
            eq(reportTemplates.teamId, team.id),
            isNull(reportTemplates.archivedAt),
          ),
        );
      const templateIds = templateRows.map((t) => t.id);
      if (templateIds.length === 0) continue;

      // 1) Lock every not-yet-locked period whose close time has passed.
      const openPeriods = await db
        .selectDistinct({ weekStart: reportInstances.weekStart })
        .from(reportInstances)
        .where(
          and(
            inArray(reportInstances.templateId, templateIds),
            ne(reportInstances.status, "locked"),
          ),
        );

      for (const w of openPeriods) {
        if (isPeriodClosed(period, w.weekStart, sched, now)) {
          const updated = await db
            .update(reportInstances)
            .set({ status: "locked", updatedAt: now })
            .where(
              and(
                inArray(reportInstances.templateId, templateIds),
                eq(reportInstances.weekStart, w.weekStart),
                ne(reportInstances.status, "locked"),
              ),
            )
            .returning({ id: reportInstances.id });
          locked += updated.length;
        }
      }

      // 2) Open the current period (once its open time has passed): ensure an
      //    empty instance exists for every active assignee.
      if (now.getTime() >= periodOpenInstant(period, periodIso, sched).getTime()) {
        const assignees = await db
          .select({
            templateId: reportAssignees.templateId,
            userId: reportAssignees.userId,
          })
          .from(reportAssignees)
          .where(inArray(reportAssignees.templateId, templateIds));

        if (assignees.length > 0) {
          const inserted = await db
            .insert(reportInstances)
            .values(
              assignees.map((a) => ({
                orgId,
                templateId: a.templateId,
                userId: a.userId,
                weekStart: periodIso,
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
  }

  // 3) Purge templates soft-deleted more than 7 days ago — permanent. The
  //    template's instances go first (answers cascade off instances); the
  //    template delete then cascades questions and assignee rows.
  const PURGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - PURGE_AFTER_MS);
  const purgeable = await db
    .select({ id: reportTemplates.id })
    .from(reportTemplates)
    .where(
      and(
        inArray(reportTemplates.orgId, orgIds),
        lt(reportTemplates.deletedAt, cutoff),
      ),
    );
  for (const t of purgeable) {
    await db.delete(reportInstances).where(eq(reportInstances.templateId, t.id));
    await db.delete(reportTemplates).where(eq(reportTemplates.id, t.id));
  }

  return NextResponse.json({
    ok: true,
    week: weekIso,
    orgs: orgIds.length,
    locked,
    created,
    purged: purgeable.length,
  });
}
