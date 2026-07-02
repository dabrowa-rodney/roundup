import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  emailLog,
  reportAssignees,
  reportInstances,
  reportTemplates,
  settings,
  users,
} from "@/db/schema";
import { mondayISO, parseISODate, weekNumberLabel, weekRange } from "@/lib/dates";
import {
  closeInstant,
  slotInstant,
  type ScheduleSettings,
} from "@/lib/lifecycle";
import { emailConfigured, reminderEmail, sendEmail } from "@/lib/email";

export const maxDuration = 60;

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

// GET /api/cron/reminders — nudge contributors who haven't submitted this week.
//
// Idempotent by design: each reminder slot fires at most once per week (claimed
// via a unique (kind, weekStart) row in email_log), and only while the week is
// still open. Safe to hit as often as you like — a daily Vercel cron means each
// reminder goes out at the first run after its slot time; pointing a more
// frequent external pinger at this URL makes the timing exact with no changes.
export async function GET(req: NextRequest) {
  if (!(await authorised(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Without an email key there is nothing useful to do (and nothing to claim —
  // reminders start flowing the week the key is added, not retroactively).
  if (!emailConfigured()) {
    return NextResponse.json({ ok: true, skipped: "email_not_configured" });
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

  const now = new Date();
  const weekStart = mondayISO(now);
  const close = closeInstant(weekStart, sched);

  // A slot is due once its time has passed, while the week is still open.
  const due = slots.filter(
    (s) =>
      s.enabled &&
      now.getTime() >=
        slotInstant(weekStart, s.day, s.time, sched.timezone).getTime() &&
      now.getTime() < close.getTime(),
  );
  if (due.length === 0) {
    return NextResponse.json({ ok: true, due: 0, sent: 0 });
  }

  // Claim each due slot (unique on kind+weekStart) — rows that already exist
  // were handled by an earlier run, so only newly-inserted claims proceed.
  const claimed = await db
    .insert(emailLog)
    .values(due.map((s) => ({ kind: s.kind, weekStart })))
    .onConflictDoNothing()
    .returning({ kind: emailLog.kind });
  if (claimed.length === 0) {
    return NextResponse.json({ ok: true, due: due.length, sent: 0 });
  }

  // Everyone assigned an active report whose instance isn't submitted/locked.
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
    .leftJoin(
      reportInstances,
      and(
        eq(reportInstances.templateId, reportAssignees.templateId),
        eq(reportInstances.userId, reportAssignees.userId),
        eq(reportInstances.weekStart, weekStart),
      ),
    )
    .where(isNull(reportTemplates.archivedAt));

  const byUser = new Map<string, { name: string; reports: string[] }>();
  for (const p of pending) {
    if (p.status === "submitted" || p.status === "locked") continue;
    const entry = byUser.get(p.email) ?? { name: p.name || p.email, reports: [] };
    entry.reports.push(p.report);
    byUser.set(p.email, entry);
  }

  const monday = parseISODate(weekStart);
  const label = `${weekNumberLabel(monday)} · ${weekRange(monday)}`;
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
        and(eq(emailLog.kind, c.kind), eq(emailLog.weekStart, weekStart)),
      );
  }

  return NextResponse.json({
    ok: true,
    due: due.length,
    claimed: claimed.map((c) => c.kind),
    pendingUsers: byUser.size,
    sent,
  });
}
