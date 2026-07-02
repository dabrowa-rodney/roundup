import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  answers,
  emailLog,
  questions,
  reportAssignees,
  reportInstances,
  reportTemplates,
  roundups,
  settings,
  users,
} from "@/db/schema";
import { emailConfigured, roundupEmail, sendEmail } from "@/lib/email";
import {
  type AnswerInput,
  type ContributorReport,
  type MetricItem,
  type SkimJson,
} from "@/lib/roundup";
import { generateRoundupAI, type PriorWeek } from "@/lib/roundup-ai";
import { fetchSheetMetrics } from "@/lib/sheets";
import { mondayISO, parseISODate, weekNumberLabel, weekRange } from "@/lib/dates";

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

// POST /api/roundups/generate  { week?: "YYYY-MM-DD" }
// Admin-only. Compiles the week's submitted reports into a draft Roundup.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const caller = (
    await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, session.user.email.toLowerCase()))
      .limit(1)
  )[0];
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const base = body.week ? new Date(body.week) : new Date();
  if (isNaN(base.getTime())) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }
  const weekStart = mondayISO(base);

  // Submitted / locked instances for the week, with contributor + template.
  const insts = await db
    .select({
      id: reportInstances.id,
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
        eq(reportInstances.weekStart, weekStart),
        inArray(reportInstances.status, ["submitted", "locked"]),
      ),
    );

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

  const totalExpected =
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

  // Pull metrics from every active template's connected Google Sheet.
  const srcRows = await db
    .select({ url: reportTemplates.dataSourceUrl })
    .from(reportTemplates)
    .where(isNull(reportTemplates.archivedAt));
  const sheetUrls = [
    ...new Set(
      srcRows
        .map((r) => r.url?.trim())
        .filter((u): u is string => !!u && u.length > 0),
    ),
  ];
  const sheetMetrics: MetricItem[] = [];
  for (const url of sheetUrls) {
    sheetMetrics.push(...(await fetchSheetMetrics(url)));
  }

  // Up to two prior weeks' Roundups, for week-over-week narrative.
  const priorRows = await db
    .select({ weekStart: roundups.weekStart, skimJson: roundups.skimJson })
    .from(roundups)
    .where(lt(roundups.weekStart, weekStart))
    .orderBy(desc(roundups.weekStart))
    .limit(2);
  const priorWeeks: PriorWeek[] = priorRows.map((r) => {
    const skim = r.skimJson as SkimJson;
    return {
      week: skim.week,
      headline: skim.headline,
      metrics: skim.metrics ?? [],
    };
  });

  const now = new Date();
  const content = await generateRoundupAI(
    {
      weekNumber: weekNumberLabel(parseISODate(weekStart)),
      range: weekRange(parseISODate(weekStart)),
      reportsIn: insts.length,
      totalExpected,
      generatedLabel: generatedLabel(now),
      contributors,
      sheetMetrics,
    },
    priorWeeks,
  );

  await db
    .insert(roundups)
    .values({
      weekStart,
      status: "draft",
      skimJson: content.skim,
      fullJson: content.full,
      generatedAt: now,
    })
    .onConflictDoUpdate({
      target: roundups.weekStart,
      set: {
        status: "draft",
        skimJson: content.skim,
        fullJson: content.full,
        generatedAt: now,
      },
    });

  // "Roundup ready" — if the Settings toggle is on, notify recipients that
  // this week's summary has been generated (at most once per week).
  if (emailConfigured()) {
    const settingsRow = (
      await db
        .select({ roundupReady: settings.reminderRoundupReady })
        .from(settings)
        .limit(1)
    )[0];
    if (settingsRow?.roundupReady) {
      const claimed = await db
        .insert(emailLog)
        .values({ kind: "roundup_ready", weekStart })
        .onConflictDoNothing()
        .returning({ id: emailLog.id });
      if (claimed.length > 0) {
        // Recipient-role users plus admins, who always receive the Roundup.
        const recipients = await db
          .select({ email: users.email })
          .from(users)
          .where(inArray(users.role, ["recipient", "admin"]));
        const msg = roundupEmail({
          weekLabel: `${weekNumberLabel(parseISODate(weekStart))} · ${weekRange(parseISODate(weekStart))}`,
          headline: content.skim.headline || "This week's Roundup is ready.",
          weekIso: weekStart,
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

  return NextResponse.json({ ok: true, reportsIn: insts.length });
}
