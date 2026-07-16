import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  answers,
  emailLog,
  organisations,
  questions,
  reportAssignees,
  reportInstances,
  reportTemplates,
  roundups,
  settings,
  teamMembers,
  teams,
  users,
} from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { getOrgPlan } from "@/lib/org-plan";
import { getSessionUser } from "@/lib/session";
import { emailConfigured, roundupEmail, sendEmail } from "@/lib/email";
import {
  selectChildRows,
  type AnswerInput,
  type ChildRoundupInput,
  type ContributorReport,
  type FullJson,
  type MetricItem,
  type MetricSeries,
  type SkimJson,
} from "@/lib/roundup";
import { generateRoundupAI, type PriorWeek } from "@/lib/roundup-ai";
import { isSkipped } from "@/lib/questions";
import { fetchSheetData } from "@/lib/sheets";
import { ensureRootTeam } from "@/lib/teams";
import {
  nextPeriodStartISO,
  periodForCadence,
  periodLabel,
  periodRange,
  periodStartISO,
} from "@/lib/dates";

// Allow up to 60s — the AI generation step calls Claude (with a 55s client-side
// timeout that falls back to the deterministic compiler before we hit this cap).
export const maxDuration = 60;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function generatedLabel(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `Generated ${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm}`;
}

// POST /api/roundups/generate  { week?: "YYYY-MM-DD", teamId?: number }
// Admin-only. Compiles a team's period into a draft Roundup. Without teamId
// the org's ROOT team is targeted — identical to the pre-teams behaviour.
//
// Inputs are gathered per the team's rollup_mode (see docs/DESIGN-nested-teams.md):
//   members  → the team's own members' submitted reports in the period
//   children → child teams' roundups (sent preferred, per D2) + reports filed
//              by the child teams' LEADS against this team's templates
//   both     → child roundups + ALL of this team's member reports
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const base = body.week ? new Date(body.week) : new Date();
  if (isNaN(base.getTime())) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  // Resolve the target team — ALWAYS scoped to the caller's org; a foreign or
  // unknown teamId is a 404, never a cross-tenant read.
  let team: {
    id: number;
    parentTeamId: number | null;
    cadence: string;
    rollupMode: string;
  };
  if (body.teamId !== undefined) {
    const teamId = Number(body.teamId);
    if (!Number.isInteger(teamId)) {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 });
    }
    const row = (
      await db
        .select({
          id: teams.id,
          parentTeamId: teams.parentTeamId,
          cadence: teams.cadence,
          rollupMode: teams.rollupMode,
        })
        .from(teams)
        .where(
          and(
            eq(teams.id, teamId),
            eq(teams.orgId, me.orgId),
            isNull(teams.archivedAt),
          ),
        )
        .limit(1)
    )[0];
    if (!row) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    team = row;
  } else {
    const rootId = await ensureRootTeam(me.orgId);
    const row = (
      await db
        .select({
          id: teams.id,
          parentTeamId: teams.parentTeamId,
          cadence: teams.cadence,
          rollupMode: teams.rollupMode,
        })
        .from(teams)
        .where(eq(teams.id, rootId))
        .limit(1)
    )[0];
    team = row;
  }

  // The team's cadence defines the period (calendar-aligned, D4).
  const period = periodForCadence(team.cadence);
  const periodStart = periodStartISO(period, base);
  const periodEnd = nextPeriodStartISO(period, periodStart);
  const rollup = team.rollupMode;

  // ── Member reports (modes: members, both; children = child leads only) ──
  // Report instances stay WEEKLY — a monthly/quarterly team aggregates every
  // submitted week inside its period window.
  let insts: {
    id: number;
    userId: number;
    userName: string | null;
    userEmail: string;
    templateName: string;
    templateArea: string | null;
  }[] = await db
    .select({
      id: reportInstances.id,
      userId: reportInstances.userId,
      userName: users.name,
      userEmail: users.email,
      templateName: reportTemplates.name,
      templateArea: reportTemplates.area,
    })
    .from(reportInstances)
    .innerJoin(users, eq(reportInstances.userId, users.id))
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
    );

  // ── Child-team roundups (modes: children, both) ──
  const childInputs: ChildRoundupInput[] = [];
  let childTeamRows: { id: number; name: string }[] = [];
  if (rollup === "children" || rollup === "both") {
    childTeamRows = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(
        and(
          eq(teams.orgId, me.orgId),
          eq(teams.parentTeamId, team.id),
          isNull(teams.archivedAt),
        ),
      );
    const childIds = childTeamRows.map((t) => t.id);
    if (childIds.length > 0) {
      const rows = await db
        .select({
          teamId: roundups.teamId,
          periodType: roundups.periodType,
          periodStart: roundups.periodStart,
          status: roundups.status,
          skimJson: roundups.skimJson,
          fullJson: roundups.fullJson,
        })
        .from(roundups)
        .where(
          and(
            inArray(roundups.teamId, childIds),
            gte(roundups.periodStart, periodStart),
            lt(roundups.periodStart, periodEnd),
          ),
        );
      const nameById = new Map(childTeamRows.map((t) => [t.id, t.name]));
      for (const childId of childIds) {
        const mine = rows.filter(
          (r) => r.teamId === childId && r.skimJson !== null,
        );
        for (const chosen of selectChildRows(mine)) {
          childInputs.push({
            teamName: nameById.get(childId) ?? "Team",
            periodLabel: periodLabel(
              chosen.periodType as "week" | "month" | "quarter",
              chosen.periodStart,
            ),
            skim: chosen.skimJson as SkimJson,
            execSummary: (chosen.fullJson as FullJson | null)?.execSummary,
          });
        }
      }
    }

    // 'children' mode: member reports narrow to the child teams' leads
    // (their upward reports); 'both' keeps every member report.
    if (rollup === "children") {
      if (childTeamRows.length > 0) {
        const leadRows = await db
          .select({ userId: teamMembers.userId })
          .from(teamMembers)
          .where(
            and(
              inArray(
                teamMembers.teamId,
                childTeamRows.map((t) => t.id),
              ),
              eq(teamMembers.role, "lead"),
            ),
          );
        const leadIds = new Set(leadRows.map((r) => r.userId));
        insts = insts.filter((i) => leadIds.has(i.userId));
      } else {
        insts = [];
      }
    }
  }

  // Nothing submitted anywhere → nothing to compile. Refuse rather than
  // produce an empty Roundup.
  if (insts.length === 0 && childInputs.length === 0) {
    return NextResponse.json(
      { error: "No reports have been submitted for this period yet" },
      { status: 409 },
    );
  }

  // Their answers, joined to question text/type/config.
  const answersByInstance = new Map<number, AnswerInput[]>();
  const instIds = insts.map((i) => i.id);
  if (instIds.length > 0) {
    const rows = await db
      .select({
        instanceId: answers.instanceId,
        value: answers.value,
        qText: questions.text,
        qType: questions.type,
        qConfig: questions.config,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(inArray(answers.instanceId, instIds));

    for (const r of rows) {
      // Deliberately skipped questions stay out of the Roundup entirely.
      if (isSkipped(r.value)) continue;
      const cfg =
        r.qConfig && typeof r.qConfig === "object"
          ? (r.qConfig as { unit?: string })
          : {};
      const list = answersByInstance.get(r.instanceId) ?? [];
      list.push({
        type: r.qType,
        text: r.qText,
        unit: cfg.unit,
        value: r.value,
      });
      answersByInstance.set(r.instanceId, list);
    }
  }

  const contributors: ContributorReport[] = insts.map((i) => ({
    name: i.userName || i.userEmail,
    area: i.templateArea || i.templateName,
    answers: answersByInstance.get(i.id) ?? [],
  }));

  // Expected member reports = assignees of THIS team's active templates.
  const totalExpected =
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
            eq(reportTemplates.teamId, team.id),
            isNull(reportTemplates.archivedAt),
          ),
        )
    )[0]?.count ?? 0;

  // Pull metrics from this team's active templates' connected Google Sheets.
  const srcRows = await db
    .select({ url: reportTemplates.dataSourceUrl })
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.orgId, me.orgId),
        eq(reportTemplates.teamId, team.id),
        isNull(reportTemplates.archivedAt),
      ),
    );
  const sheetUrls = [
    ...new Set(
      srcRows
        .map((r) => r.url?.trim())
        .filter((u): u is string => !!u && u.length > 0),
    ),
  ];
  const sheetMetrics: MetricItem[] = [];
  const sheetSeries: MetricSeries[] = [];
  for (const url of sheetUrls) {
    const data = await fetchSheetData(url);
    sheetMetrics.push(...data.metrics);
    sheetSeries.push(...data.series);
  }

  // Up to two prior periods of this team's Roundups, for period-over-period
  // narrative.
  const priorRows = await db
    .select({ periodStart: roundups.periodStart, skimJson: roundups.skimJson })
    .from(roundups)
    .where(
      and(
        eq(roundups.teamId, team.id),
        eq(roundups.periodType, period),
        lt(roundups.periodStart, periodStart),
      ),
    )
    .orderBy(desc(roundups.periodStart))
    .limit(2);
  const priorWeeks: PriorWeek[] = priorRows
    .filter((r) => r.skimJson !== null)
    .map((r) => {
      const skim = r.skimJson as SkimJson;
      return {
        week: skim.week,
        headline: skim.headline,
        metrics: skim.metrics ?? [],
      };
    });

  // AI is a paid-plan feature, powered by the platform's Anthropic account.
  // An org's own key (BYO) acts as an override — usage billed to them
  // instead. Free-tier orgs compile deterministically either way.
  const plan = await getOrgPlan(me.orgId);
  const org = (
    await db
      .select({ keyEnc: organisations.anthropicKeyEnc })
      .from(organisations)
      .where(eq(organisations.id, me.orgId))
      .limit(1)
  )[0];
  const aiKey = plan.limits.ai
    ? (decryptSecret(org?.keyEnc) ?? process.env.ANTHROPIC_API_KEY ?? null)
    : null;

  const now = new Date();
  const content = await generateRoundupAI(
    {
      weekNumber: periodLabel(period, periodStart),
      range: periodRange(period, periodStart),
      reportsIn: insts.length,
      totalExpected,
      generatedLabel: generatedLabel(now),
      contributors,
      childRoundups: childInputs,
      sheetMetrics,
      sheetSeries,
    },
    priorWeeks,
    aiKey,
  );

  await db
    .insert(roundups)
    .values({
      orgId: me.orgId,
      teamId: team.id,
      periodType: period,
      periodStart,
      weekStart: periodStart, // legacy mirror
      status: "draft",
      skimJson: content.skim,
      fullJson: content.full,
      generatedAt: now,
    })
    .onConflictDoUpdate({
      target: [roundups.teamId, roundups.periodType, roundups.periodStart],
      set: {
        status: "draft",
        skimJson: content.skim,
        fullJson: content.full,
        generatedAt: now,
      },
    });

  // "Roundup ready" — org-wide notification, ROOT team only (sub-team
  // distribution is per-roundup recipients, wired in the send flow).
  if (team.parentTeamId === null && emailConfigured()) {
    const settingsRow = (
      await db
        .select({ roundupReady: settings.reminderRoundupReady })
        .from(settings)
        .where(eq(settings.orgId, me.orgId))
        .limit(1)
    )[0];
    if (settingsRow?.roundupReady) {
      const claimed = await db
        .insert(emailLog)
        .values({ orgId: me.orgId, kind: "roundup_ready", weekStart: periodStart })
        .onConflictDoNothing()
        .returning({ id: emailLog.id });
      if (claimed.length > 0) {
        // Recipient-role users plus admins, who always receive the Roundup.
        const recipients = await db
          .select({ email: users.email })
          .from(users)
          .where(
            and(
              eq(users.orgId, me.orgId),
              inArray(users.role, ["recipient", "admin"]),
            ),
          );
        const msg = roundupEmail({
          weekLabel: `${periodLabel(period, periodStart)} · ${periodRange(period, periodStart)}`,
          headline: content.skim.headline || "This week's Roundup is ready.",
          weekIso: periodStart,
        });
        let emailed = 0;
        for (const r of recipients) {
          if (await sendEmail({ to: r.email, ...msg })) emailed++;
        }
        await db
          .update(emailLog)
          .set({ recipientCount: emailed })
          .where(eq(emailLog.id, claimed[0].id));
      }
    }
  }

  return NextResponse.json({
    ok: true,
    reportsIn: insts.length,
    childRoundups: childInputs.length,
  });
}
