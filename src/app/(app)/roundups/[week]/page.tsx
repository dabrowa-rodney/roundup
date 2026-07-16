import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { ArrowLeft, FileText } from "lucide-react";
import { db } from "@/db";
import { reportInstances, reportTemplates, roundups, teams } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { Screen } from "@/components/screen";
import { RoundupViewer } from "@/components/roundup-viewer";
import { GenerateRoundupButton } from "@/components/roundup-generate";
import {
  nextPeriodStartISO,
  periodForCadence,
  periodLabel,
  periodRange,
  periodStartISO,
} from "@/lib/dates";
import { ensureRootTeam } from "@/lib/teams";
import type { FullJson, SkimJson } from "@/lib/roundup";

const TEAM_COLS = {
  id: teams.id,
  parentTeamId: teams.parentTeamId,
  name: teams.name,
  cadence: teams.cadence,
  rollupMode: teams.rollupMode,
};

export default async function RoundupViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ week: string }>;
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  const { week } = await params;
  const sp = await searchParams;

  const me = await getSessionUser();
  const isAdmin = me?.role === "admin";
  // Admins manage roundups; recipients may read sent ones. Contributors
  // have no roundup access.
  if (!me || (!isAdmin && me.role !== "recipient")) redirect("/my-reports");

  const rootTeamId = await ensureRootTeam(me.orgId);

  // Resolve the target team. Admins may address any ACTIVE team in their own
  // org via ?team=ID; anything else (foreign, archived, garbage) falls back
  // to the root team. Recipients are always pinned to root — their access is
  // the root team's SENT roundups only.
  const teamParam = Array.isArray(sp.team) ? sp.team[0] : sp.team;
  const requestedId = Number(teamParam);
  let team:
    | {
        id: number;
        parentTeamId: number | null;
        name: string;
        cadence: string;
        rollupMode: string;
      }
    | undefined;
  if (
    isAdmin &&
    teamParam !== undefined &&
    Number.isInteger(requestedId) &&
    requestedId !== rootTeamId
  ) {
    team = (
      await db
        .select(TEAM_COLS)
        .from(teams)
        .where(
          and(
            eq(teams.id, requestedId),
            eq(teams.orgId, me.orgId),
            isNull(teams.archivedAt),
          ),
        )
        .limit(1)
    )[0];
  }
  if (!team) {
    team = (
      await db.select(TEAM_COLS).from(teams).where(eq(teams.id, rootTeamId)).limit(1)
    )[0];
  }
  const isRoot = team.id === rootTeamId;
  // Only threaded when non-root — the APIs and links default to root.
  const teamIdParam = isRoot ? undefined : team.id;

  // The team's cadence defines the period; the week param is normalised to
  // the containing period's calendar-aligned start.
  const period = periodForCadence(team.cadence);
  const parsed = new Date(week);
  const periodStart = periodStartISO(
    period,
    isNaN(parsed.getTime()) ? new Date() : parsed,
  );
  const periodEnd = nextPeriodStartISO(period, periodStart);

  const roundup = (
    await db
      .select()
      .from(roundups)
      .where(
        and(
          eq(roundups.teamId, team.id),
          eq(roundups.periodType, period),
          eq(roundups.periodStart, periodStart),
        ),
      )
      .limit(1)
  )[0];

  // Recipients only ever see the distributed version — drafts and previews
  // stay with admins.
  if (!isAdmin && roundup?.status !== "sent") redirect("/roundups");

  // Generation compiles submitted/locked reports (or, for roll-up teams,
  // child roundups) — with none, there is nothing to preview, so the button
  // is withheld (the API refuses too).
  let hasReports = Boolean(roundup);
  if (!hasReports && isAdmin) {
    const memberCount =
      (
        await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reportInstances)
          .innerJoin(
            reportTemplates,
            eq(reportInstances.templateId, reportTemplates.id),
          )
          .where(
            and(
              eq(reportInstances.orgId, me.orgId),
              eq(reportTemplates.teamId, team.id),
              gte(reportInstances.weekStart, periodStart),
              lt(reportInstances.weekStart, periodEnd),
              inArray(reportInstances.status, ["submitted", "locked"]),
            ),
          )
      )[0]?.count ?? 0;
    hasReports = memberCount > 0;

    // Roll-up teams can also compile from their children's roundups.
    if (
      !hasReports &&
      (team.rollupMode === "children" || team.rollupMode === "both")
    ) {
      const childRows = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.orgId, me.orgId),
            eq(teams.parentTeamId, team.id),
            isNull(teams.archivedAt),
          ),
        );
      if (childRows.length > 0) {
        const childCount =
          (
            await db
              .select({ count: sql<number>`count(*)::int` })
              .from(roundups)
              .where(
                and(
                  inArray(
                    roundups.teamId,
                    childRows.map((c) => c.id),
                  ),
                  gte(roundups.periodStart, periodStart),
                  lt(roundups.periodStart, periodEnd),
                  isNotNull(roundups.skimJson),
                ),
              )
          )[0]?.count ?? 0;
        hasReports = childCount > 0;
      }
    }
  }

  return (
    <Screen>
      {roundup?.skimJson && roundup?.fullJson ? (
        <RoundupViewer
          skim={roundup.skimJson as SkimJson}
          full={roundup.fullJson as FullJson}
          week={periodStart}
          sent={roundup.status === "sent"}
          canManage={isAdmin}
          roundupId={roundup.id}
          teamId={teamIdParam}
          teamName={team.name}
          periodType={period}
        />
      ) : (
        <NotGenerated
          week={periodStart}
          isAdmin={isAdmin}
          hasReports={hasReports}
          teamId={teamIdParam}
          teamName={team.name}
          periodHeading={`${periodLabel(period, periodStart)} · ${periodRange(period, periodStart)}`}
          isWeekly={period === "week"}
        />
      )}
    </Screen>
  );
}

function NotGenerated({
  week,
  isAdmin,
  hasReports,
  teamId,
  teamName,
  periodHeading,
  isWeekly,
}: {
  week: string;
  isAdmin: boolean;
  hasReports: boolean;
  teamId?: number;
  teamName: string;
  periodHeading: string;
  isWeekly: boolean;
}) {
  const periodWord = isWeekly ? "week" : "period";
  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href={teamId === undefined ? "/roundups" : `/roundups?team=${teamId}`}
        className="mb-[22px] inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-[7px] text-[13px] font-semibold text-muted"
      >
        <ArrowLeft size={15} /> All roundups
      </Link>
      <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
          <FileText size={22} className="text-accent" />
        </div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
          {teamName} · {periodHeading}
        </div>
        <div className="mt-1.5 font-head text-[20px] font-bold">
          No Roundup generated yet
        </div>
        <p className="mx-auto mb-5 mt-1.5 max-w-[440px] text-[14px] text-muted">
          Compile this {periodWord}&apos;s submitted reports into a Roundup
          summary — risks, highlights, key metrics and a per-team rundown.
        </p>
        {isAdmin && hasReports ? (
          <div className="flex justify-center">
            <GenerateRoundupButton week={week} teamId={teamId} />
          </div>
        ) : isAdmin ? (
          <p className="text-[13px] font-medium text-muted">
            No reports have been submitted for this {periodWord} yet —
            generating unlocks once the first one is in.
          </p>
        ) : (
          <p className="text-[13px] text-muted">
            An administrator can generate it once reports are in.
          </p>
        )}
      </div>
    </div>
  );
}
