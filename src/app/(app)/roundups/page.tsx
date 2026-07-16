import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";
import { Screen } from "@/components/screen";
import { db } from "@/db";
import {
  reportAssignees,
  reportInstances,
  reportTemplates,
  roundups,
  settings,
  teams,
} from "@/db/schema";
import {
  parseISODate,
  periodForCadence,
  periodLabel,
  periodRange,
  periodStartISO,
  weekNumberLabel,
  weekRange,
  type PeriodType,
} from "@/lib/dates";
import { ensureRootTeam } from "@/lib/teams";

const COLS = "min-w-[680px] grid-cols-[1.2fr_1.4fr_1fr_1fr_90px]";
// Recipients see sent roundups only, without the ops detail.
const COLS_READER = "min-w-[480px] grid-cols-[1.2fr_1.6fr_90px]";

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

const PERIOD_EYEBROW: Record<PeriodType, string> = {
  week: "THIS WEEK",
  month: "THIS MONTH",
  quarter: "THIS QUARTER",
};

type TeamRow = {
  id: number;
  parentTeamId: number | null;
  name: string;
  cadence: string;
};

/** Depth-first flattening of the team tree for the indented selector. */
function flattenTeams(rows: TeamRow[]): { team: TeamRow; depth: number }[] {
  const out: { team: TeamRow; depth: number }[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const t of rows.filter((r) => r.parentTeamId === parentId)) {
      out.push({ team: t, depth });
      walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default async function RoundupsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  // Admins manage roundups; recipients may read sent ones. Contributors
  // have no roundup access.
  const me = await getSessionUser();
  if (!me || (me.role !== "admin" && me.role !== "recipient"))
    redirect("/my-reports");
  const isAdmin = me.role === "admin";

  const rootTeamId = await ensureRootTeam(me.orgId);

  // Recipients: a simple reading list of everything the ROOT team has sent
  // (sub-team roundups are distributed per-roundup, not via this page).
  if (!isAdmin) {
    const sentRoundups = await db
      .select({ weekStart: roundups.weekStart })
      .from(roundups)
      .where(
        and(eq(roundups.teamId, rootTeamId), eq(roundups.status, "sent")),
      );
    const sentWeeks = sentRoundups
      .map((r) => r.weekStart)
      .sort()
      .reverse();

    return (
      <Screen title="Roundups" subtitle="Weekly summaries sent to you">
        {sentWeeks.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
            <div className="font-head text-[18px] font-bold">
              No roundups yet
            </div>
            <p className="mx-auto mt-1.5 max-w-[440px] text-[14px] text-muted">
              Once a weekly Roundup is sent, it will appear here to read any
              time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <div
              className={`grid ${COLS_READER} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted`}
            >
              <span>WEEK</span>
              <span>RANGE</span>
              <span />
            </div>
            {sentWeeks.map((weekStart) => {
              const d = parseISODate(weekStart);
              return (
                <div
                  key={weekStart}
                  className={`grid ${COLS_READER} items-center gap-3.5 border-t border-line px-[22px] py-[15px]`}
                >
                  <span className="font-head text-[14.5px] font-bold">
                    {weekNumberLabel(d)}
                  </span>
                  <span className="text-[13.5px] text-muted">
                    {weekRange(d)}
                  </span>
                  <Link
                    href={`/roundups/${weekStart}`}
                    className="text-right text-[13.5px] font-bold text-accent"
                  >
                    Read →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </Screen>
    );
  }

  // ── Admin view: one periods table per team, root by default ──

  // Active teams — the selector list AND the ?team validation set. A team id
  // outside the caller's org (or archived, or garbage) falls back to root.
  const teamRows: TeamRow[] = await db
    .select({
      id: teams.id,
      parentTeamId: teams.parentTeamId,
      name: teams.name,
      cadence: teams.cadence,
    })
    .from(teams)
    .where(and(eq(teams.orgId, me.orgId), isNull(teams.archivedAt)))
    .orderBy(asc(teams.createdAt));

  const sp = await searchParams;
  const teamParam = Array.isArray(sp.team) ? sp.team[0] : sp.team;
  const requestedId = Number(teamParam);
  const selectedTeam: TeamRow =
    (Number.isInteger(requestedId)
      ? teamRows.find((t) => t.id === requestedId)
      : undefined) ??
    teamRows.find((t) => t.id === rootTeamId) ??
    // ensureRootTeam guarantees a root exists; this is a type-level fallback.
    { id: rootTeamId, parentTeamId: null, name: "All teams", cadence: "weekly" };

  const isRoot = selectedTeam.id === rootTeamId;
  const teamQS = isRoot ? "" : `?team=${selectedTeam.id}`;
  const period = periodForCadence(selectedTeam.cadence);
  const currentPeriodISO = periodStartISO(period, new Date());

  // Close schedule (for the weekly banner), with defaults if unset.
  const settingsRow = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.orgId, me.orgId))
      .limit(1)
  )[0];
  const closeDay = settingsRow?.closeDay ?? "Sunday";
  const closeTime = settingsRow?.closeTime ?? "20:00";

  // Reports-in counts. Root keeps the original org-wide weekly logic; a
  // selected sub-team scopes both sides to ITS templates, bucketing weekly
  // instances into the team's period windows via the period key.
  let totalExpected = 0;
  const submittedByPeriod = new Map<string, number>();

  if (isRoot) {
    totalExpected =
      (
        await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reportAssignees)
          .innerJoin(
            reportTemplates,
            eq(reportAssignees.templateId, reportTemplates.id),
          )
          .where(
            and(
              eq(reportTemplates.orgId, me.orgId),
              isNull(reportTemplates.archivedAt),
            ),
          )
      )[0]?.count ?? 0;

    const weekAgg = await db
      .select({
        weekStart: reportInstances.weekStart,
        submitted: sql<number>`count(*) filter (where status in ('submitted','locked'))::int`,
      })
      .from(reportInstances)
      .where(eq(reportInstances.orgId, me.orgId))
      .groupBy(reportInstances.weekStart);
    for (const a of weekAgg) submittedByPeriod.set(a.weekStart, a.submitted);
  } else {
    totalExpected =
      (
        await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reportAssignees)
          .innerJoin(
            reportTemplates,
            eq(reportAssignees.templateId, reportTemplates.id),
          )
          .where(
            and(
              eq(reportTemplates.orgId, me.orgId),
              eq(reportTemplates.teamId, selectedTeam.id),
              isNull(reportTemplates.archivedAt),
            ),
          )
      )[0]?.count ?? 0;

    // Stage-3 instances carry period starts in weekStart, so keying each row
    // by its containing period start is exact for weekly teams and correct
    // bucketing for monthly/quarterly ones.
    const instRows = await db
      .select({
        weekStart: reportInstances.weekStart,
        status: reportInstances.status,
      })
      .from(reportInstances)
      .innerJoin(
        reportTemplates,
        eq(reportInstances.templateId, reportTemplates.id),
      )
      .where(
        and(
          eq(reportInstances.orgId, me.orgId),
          eq(reportTemplates.teamId, selectedTeam.id),
        ),
      );
    for (const r of instRows) {
      const key = periodStartISO(period, parseISODate(r.weekStart));
      const submitted =
        r.status === "submitted" || r.status === "locked" ? 1 : 0;
      submittedByPeriod.set(key, (submittedByPeriod.get(key) ?? 0) + submitted);
    }
  }

  const roundupRows = await db
    .select({ periodStart: roundups.periodStart, status: roundups.status })
    .from(roundups)
    .where(
      and(
        eq(roundups.teamId, selectedTeam.id),
        eq(roundups.periodType, period),
      ),
    );

  const byPeriod = new Map<
    string,
    { periodStart: string; submitted: number; status: string | null }
  >();
  for (const [periodStart, submitted] of submittedByPeriod) {
    byPeriod.set(periodStart, { periodStart, submitted, status: null });
  }
  for (const r of roundupRows) {
    const existing = byPeriod.get(r.periodStart) ?? {
      periodStart: r.periodStart,
      submitted: 0,
      status: null,
    };
    existing.status = r.status;
    byPeriod.set(r.periodStart, existing);
  }

  const periods = [...byPeriod.values()].sort((a, b) =>
    a.periodStart < b.periodStart ? 1 : -1,
  );

  const submittedThisPeriod = byPeriod.get(currentPeriodISO)?.submitted ?? 0;

  const flatTeams = flattenTeams(teamRows);
  const cadenceWord = selectedTeam.cadence; // 'weekly' | 'monthly' | 'quarterly'

  return (
    <Screen
      title="Roundups"
      subtitle={
        isRoot
          ? `Generated ${cadenceWord} summaries`
          : `${selectedTeam.name} · generated ${cadenceWord} summaries`
      }
    >
      {/* Team selector — only when the org has grown beyond its root team */}
      {flatTeams.length > 1 && (
        <div className="mb-[22px] rounded-card border border-line bg-surface px-[18px] pb-3 pt-3.5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            Team
          </div>
          <div className="mt-2 flex flex-col items-start gap-0.5">
            {flatTeams.map(({ team, depth }) => {
              const active = team.id === selectedTeam.id;
              return (
                <Link
                  key={team.id}
                  href={
                    team.id === rootTeamId
                      ? "/roundups"
                      : `/roundups?team=${team.id}`
                  }
                  style={{ marginLeft: depth * 18 }}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-[5px] text-[13px] font-semibold ${
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-ink hover:bg-line/40"
                  }`}
                >
                  {team.name}
                  <span
                    className={`text-[11px] font-medium ${
                      active ? "text-accent/70" : "text-muted"
                    }`}
                  >
                    {team.cadence}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Current-period banner */}
      <div className="mb-[22px] flex flex-wrap items-center gap-5 rounded-card bg-accent px-[26px] py-6 text-accent-ink">
        <div className="min-w-[220px] flex-1">
          <div className="text-[12.5px] font-bold tracking-[0.05em] opacity-80">
            {PERIOD_EYEBROW[period]} ·{" "}
            {periodLabel(period, currentPeriodISO).toUpperCase()}
          </div>
          <div className="mt-[5px] font-head text-[20px] font-bold">
            {submittedThisPeriod} of {totalExpected} report
            {totalExpected === 1 ? "" : "s"} in
            {period === "week" ? ` — closes ${closeDay} ${closeTime}` : ""}
          </div>
          <div className="mt-1 text-[13.5px] opacity-85">
            {submittedThisPeriod > 0
              ? "Generate the Roundup once the window closes, or draft a preview now."
              : "A preview unlocks once the first report is submitted."}
          </div>
        </div>
        {submittedThisPeriod > 0 ? (
          <Link
            href={`/roundups/${currentPeriodISO}${teamQS}`}
            className="rounded-full bg-accent-ink px-[22px] py-3 text-sm font-bold text-accent"
          >
            Generate preview
          </Link>
        ) : (
          <span
            aria-disabled
            title="No reports submitted yet"
            className="cursor-not-allowed rounded-full bg-accent-ink/50 px-[22px] py-3 text-sm font-bold text-accent/70"
          >
            Generate preview
          </span>
        )}
      </div>

      {/* Periods table */}
      {periods.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <div className="font-head text-[18px] font-bold">No roundups yet</div>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[14px] text-muted">
            {period === "week"
              ? "Once contributors start filing this week's reports, the week will appear here — and you can generate its Roundup."
              : "Once this team's reports start coming in, each period will appear here — and you can generate its Roundup."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <div
            className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted`}
          >
            <span>{period === "week" ? "WEEK" : "PERIOD"}</span>
            <span>RANGE</span>
            <span>REPORTS IN</span>
            <span>STATUS</span>
            <span />
          </div>
          {periods.map((p) => (
            <div
              key={p.periodStart}
              className={`grid ${COLS} items-center gap-3.5 border-t border-line px-[22px] py-[15px]`}
            >
              <span className="font-head text-[14.5px] font-bold">
                {periodLabel(period, p.periodStart)}
              </span>
              <span className="text-[13.5px] text-muted">
                {periodRange(period, p.periodStart)}
              </span>
              <span className="text-[13.5px]">
                {p.submitted} of {totalExpected}
              </span>
              <span>
                <StatusPill status={statusLabel(p.status)} />
              </span>
              <Link
                href={`/roundups/${p.periodStart}${teamQS}`}
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
