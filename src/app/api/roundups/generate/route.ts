import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  answers,
  questions,
  reportAssignees,
  reportInstances,
  reportTemplates,
  roundups,
  users,
} from "@/db/schema";
import {
  compileRoundup,
  type AnswerInput,
  type ContributorReport,
  type MetricItem,
} from "@/lib/roundup";
import { fetchSheetMetrics } from "@/lib/sheets";
import { mondayISO, parseISODate, weekNumberLabel, weekRange } from "@/lib/dates";

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

  const now = new Date();
  const content = compileRoundup({
    weekNumber: weekNumberLabel(parseISODate(weekStart)),
    range: weekRange(parseISODate(weekStart)),
    reportsIn: insts.length,
    totalExpected,
    generatedLabel: generatedLabel(now),
    contributors,
    sheetMetrics,
  });

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

  return NextResponse.json({ ok: true, reportsIn: insts.length });
}
