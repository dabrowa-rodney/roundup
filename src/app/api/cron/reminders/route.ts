import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  emailLog,
  organisations,
  reportAssignees,
  reportInstances,
  reportTemplates,
  settings,
  teams,
  users,
} from "@/db/schema";
import { mondayISO, parseISODate, weekNumberLabel, weekRange } from "@/lib/dates";
import {
  closeInstant,
  slotInstant,
  type ScheduleSettings,
} from "@/lib/lifecycle";
import { emailConfigured, reminderEmail, sendEmail } from "@/lib/email";
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
  const me = await getSessionUser();
  if (me?.role === "admin") return [me.orgId];
  return null;
}

// GET /api/cron/reminders — for every organisation, nudge contributors who
// haven't submitted this week. Idempotent per org: each reminder slot fires at
// most once per week (claimed via the unique (org, kind, weekStart) row in
// email_log), and only while that org's week is still open.
export async function GET(req: NextRequest) {
  const orgIds = await authorisedOrgIds(req);
  if (!orgIds) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Without an email key there is nothing useful to do (and nothing to claim —
  // reminders start flowing the week the key is added, not retroactively).
  if (!emailConfigured()) {
    return NextResponse.json({ ok: true, skipped: "email_not_configured" });
  }

  const now = new Date();
  const weekStart = mondayISO(now);
  const monday = parseISODate(weekStart);
  const label = `${weekNumberLabel(monday)} · ${weekRange(monday)}`;

  let totalSent = 0;
  const perOrg: Record<number, { claimed: string[]; sent: number }> = {};

  for (const orgId of orgIds) {
    const row = (
      await db.select().from(settings).where(eq(settings.orgId, orgId)).limit(1)
    )[0];
    const sched: ScheduleSettings = row
      ? {
          closeDay: row.closeDay,
          closeTime: row.closeTime,
          openDay: row.openDay,
          openTime: row.openTime,
          timezone: row.timezone,
        }
      : DEFAULT_SCHEDULE;

    const slots = [
      {
        kind: "reminder1",
        enabled: row?.reminder1Enabled ?? true,
        day: row?.reminder1Day ?? "Thursday",
        time: row?.reminder1Time ?? "13:00",
      },
      {
        kind: "reminder2",
        enabled: row?.reminder2Enabled ?? true,
        day: row?.reminder2Day ?? "Friday",
        time: row?.reminder2Time ?? "09:00",
      },
    ];

    const close = closeInstant(weekStart, sched);

    // A slot is due once its time has passed, while the week is still open.
    const due = slots.filter(
      (s) =>
        s.enabled &&
        now.getTime() >=
          slotInstant(weekStart, s.day, s.time, sched.timezone).getTime() &&
        now.getTime() < close.getTime(),
    );
    if (due.length === 0) continue;

    // Claim each due slot (unique on org+kind+weekStart) — rows that already
    // exist were handled by an earlier run.
    const claimed = await db
      .insert(emailLog)
      .values(due.map((s) => ({ orgId, kind: s.kind, weekStart })))
      .onConflictDoNothing()
      .returning({ kind: emailLog.kind });
    if (claimed.length === 0) continue;

    // Everyone in this org assigned an active WEEKLY report whose instance
    // isn't submitted/locked. Reminder slots are week-shaped, so they only
    // apply to weekly-cadence teams — monthly/quarterly reports don't nag.
    const pending = await db
      .select({
        email: users.email,
        name: users.name,
        report: reportTemplates.name,
        status: reportInstances.status,
      })
      .from(reportAssignees)
      .innerJoin(users, eq(reportAssignees.userId, users.id))
      .innerJoin(
        reportTemplates,
        eq(reportAssignees.templateId, reportTemplates.id),
      )
      .innerJoin(teams, eq(reportTemplates.teamId, teams.id))
      .leftJoin(
        reportInstances,
        and(
          eq(reportInstances.templateId, reportAssignees.templateId),
          eq(reportInstances.userId, reportAssignees.userId),
          eq(reportInstances.weekStart, weekStart),
        ),
      )
      .where(
        and(
          eq(reportTemplates.orgId, orgId),
          isNull(reportTemplates.archivedAt),
          // Don't nag members of an archived team — their reports can't roll up.
          isNull(teams.archivedAt),
          eq(teams.cadence, "weekly"),
        ),
      );

    const byUser = new Map<string, { name: string; reports: string[] }>();
    for (const p of pending) {
      if (p.status === "submitted" || p.status === "locked") continue;
      const entry =
        byUser.get(p.email) ?? { name: p.name || p.email, reports: [] };
      entry.reports.push(p.report);
      byUser.set(p.email, entry);
    }

    const closeLabel = `${sched.closeDay} ${sched.closeTime}`;

    // One nudge per person, even if two slots became due in the same run.
    let sent = 0;
    for (const [email, entry] of byUser) {
      const msg = reminderEmail({
        name: entry.name,
        weekLabel: label,
        reportNames: entry.reports,
        closeLabel,
      });
      if (await sendEmail({ to: email, ...msg })) sent++;
    }

    // Record how many actually went out on the claimed slots.
    for (const c of claimed) {
      await db
        .update(emailLog)
        .set({ recipientCount: sent })
        .where(
          and(
            eq(emailLog.orgId, orgId),
            eq(emailLog.kind, c.kind),
            eq(emailLog.weekStart, weekStart),
          ),
        );
    }

    totalSent += sent;
    perOrg[orgId] = { claimed: claimed.map((c) => c.kind), sent };
  }

  return NextResponse.json({
    ok: true,
    orgs: orgIds.length,
    sent: totalSent,
    perOrg,
  });
}
