import Link from "next/link";
import { eq, isNull, sql } from "drizzle-orm";
import { Screen } from "@/components/screen";
import { db } from "@/db";
import {
  reportAssignees,
  reportInstances,
  reportTemplates,
  roundups,
  settings,
} from "@/db/schema";
import { mondayOf, weekNumberLabel, weekRange } from "@/lib/dates";

const COLS = "grid-cols-[1.2fr_1.4fr_1fr_1fr_90px]";

type Status = "Pending" | "Draft" | "Sent";

function statusLabel(s: string | null): Status {
  if (s === "sent") return "Sent";
  if (s === "draft") return "Draft";
  return "Pending";
}

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    Sent: "bg-good-soft text-good-ink",
    Draft: "bg-warn-soft text-warn-ink",
    Pending: "bg-line/50 text-muted",
  };
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function RoundupsPage() {
  const monday = mondayOf(new Date());

  // Close schedule (for the banner), with defaults if unset.
  const settingsRow = (await db.select().from(settings).limit(1))[0];
  const closeDay = settingsRow?.closeDay ?? "Sunday";
  const closeTime = settingsRow?.closeTime ?? "20:00";

  // How many reports are expected each week = active template × assignee pairs.
  const totalAssignments =
    (
      await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reportAssignees)
        .innerJoin(
          reportTemplates,
          eq(reportAssignees.templateId, reportTemplates.id),
        )
        .where(isNull(reportTemplates.archivedAt))
    )[0]?.count ?? 0;

  // Submitted counts per week.
  const weekAgg = await db
    .select({
      weekStart: reportInstances.weekStart,
      submitted: sql<number>`count(*) filter (where status in ('submitted','locked'))::int`,
    })
    .from(reportInstances)
    .groupBy(reportInstances.weekStart);

  const roundupRows = await db.select().from(roundups);

  // Merge instance weeks + roundup rows into one per-week list.
  const byWeek = new Map<
    string,
    { weekStart: Date; submitted: number; status: string | null }
  >();
  for (const a of weekAgg) {
    const ws = new Date(a.weekStart);
    byWeek.set(ws.toISOString(), {
      weekStart: ws,
      submitted: a.submitted,
      status: null,
    });
  }
  for (const r of roundupRows) {
    const ws = new Date(r.weekStart);
    const key = ws.toISOString();
    const existing = byWeek.get(key) ?? {
      weekStart: ws,
      submitted: 0,
      status: null,
    };
    existing.status = r.status;
    byWeek.set(key, existing);
  }

  const weeks = [...byWeek.values()].sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
  );

  const submittedThisWeek =
    byWeek.get(monday.toISOString())?.submitted ?? 0;

  return (
    <Screen title="Roundups" subtitle="Generated weekly summaries">
      {/* This-week banner */}
      <div className="mb-[22px] flex flex-wrap items-center gap-5 rounded-card bg-accent px-[26px] py-6 text-accent-ink">
        <div className="min-w-[220px] flex-1">
          <div className="text-[12.5px] font-bold tracking-[0.05em] opacity-80">
            THIS WEEK · {weekNumberLabel(monday)}
          </div>
          <div className="mt-[5px] font-head text-[20px] font-bold">
            {submittedThisWeek} of {totalAssignments} report
            {totalAssignments === 1 ? "" : "s"} in — closes {closeDay}{" "}
            {closeTime}
          </div>
          <div className="mt-1 text-[13.5px] opacity-85">
            Generate the Roundup once the window closes, or draft a preview now.
          </div>
        </div>
        <Link
          href={`/roundups/${isoDate(monday)}`}
          className="rounded-full bg-accent-ink px-[22px] py-3 text-sm font-bold text-accent"
        >
          Generate preview
        </Link>
      </div>

      {/* Weeks table */}
      {weeks.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <div className="font-head text-[18px] font-bold">
            No roundups yet
          </div>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[14px] text-muted">
            Once contributors start filing this week&apos;s reports, the week
            will appear here — and you can generate its Roundup.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div
            className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-bold tracking-[0.04em] text-muted`}
          >
            <span>WEEK</span>
            <span>RANGE</span>
            <span>REPORTS IN</span>
            <span>STATUS</span>
            <span />
          </div>
          {weeks.map((w) => (
            <div
              key={w.weekStart.toISOString()}
              className={`grid ${COLS} items-center gap-3.5 border-t border-line px-[22px] py-[15px]`}
            >
              <span className="font-head text-[14.5px] font-bold">
                {weekNumberLabel(w.weekStart)}
              </span>
              <span className="text-[13.5px] text-muted">
                {weekRange(w.weekStart)}
              </span>
              <span className="text-[13.5px]">
                {w.submitted} of {totalAssignments}
              </span>
              <span>
                <StatusPill status={statusLabel(w.status)} />
              </span>
              <Link
                href={`/roundups/${isoDate(w.weekStart)}`}
                className="text-right text-[13.5px] font-bold text-accent"
              >
                View →
              </Link>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
