import { notFound, redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  answers,
  questions,
  reportAssignees,
  reportInstances,
  reportTemplates,
  settings,
  teams,
} from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { Screen } from "@/components/screen";
import { ReportForm } from "@/components/report-form";
import {
  parseISODate,
  periodForCadence,
  periodLabel,
  periodRange,
  periodStartISO,
  weekLabel,
} from "@/lib/dates";
import { isPeriodClosed, type ScheduleSettings } from "@/lib/lifecycle";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId)) notFound();

  const me = await getSessionUser();
  if (!me) redirect("/login");

  const template = (
    await db
      .select({
        id: reportTemplates.id,
        name: reportTemplates.name,
        teamCadence: teams.cadence,
      })
      .from(reportTemplates)
      .innerJoin(teams, eq(reportTemplates.teamId, teams.id))
      .where(
        and(
          eq(reportTemplates.id, templateId),
          eq(reportTemplates.orgId, me.orgId),
          isNull(reportTemplates.archivedAt),
        ),
      )
      .limit(1)
  )[0];
  if (!template) notFound();

  // Only an assignee (or an admin) may open the report.
  const assignment = (
    await db
      .select({ id: reportAssignees.id })
      .from(reportAssignees)
      .where(
        and(
          eq(reportAssignees.templateId, templateId),
          eq(reportAssignees.userId, me.id),
        ),
      )
      .limit(1)
  )[0];
  if (!assignment && me.role !== "admin") redirect("/my-reports");

  // The reporting period follows the template's TEAM cadence: weekly teams
  // file weekly; monthly/quarterly teams file once per calendar period
  // (weekStart carries the period's first day).
  const period = periodForCadence(template.teamCadence);
  const periodIso = periodStartISO(period, new Date());

  // Get-or-create the current period's instance for the current user.
  await db
    .insert(reportInstances)
    .values({
      orgId: me.orgId,
      templateId,
      userId: me.id,
      weekStart: periodIso,
      status: "not_started",
      openedAt: new Date(),
    })
    .onConflictDoNothing();

  const instance = (
    await db
      .select()
      .from(reportInstances)
      .where(
        and(
          eq(reportInstances.templateId, templateId),
          eq(reportInstances.userId, me.id),
          eq(reportInstances.weekStart, periodIso),
        ),
      )
      .limit(1)
  )[0];

  const qs = await db
    .select()
    .from(questions)
    .where(
      and(eq(questions.templateId, templateId), isNull(questions.archivedAt)),
    )
    .orderBy(asc(questions.order));

  const existing = await db
    .select()
    .from(answers)
    .where(eq(answers.instanceId, instance.id));

  const initialValues: Record<number, unknown> = {};
  for (const a of existing) initialValues[a.questionId] = a.value;

  // Editing is blocked once the week's close time has passed (or it's locked).
  const s = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.orgId, me.orgId))
      .limit(1)
  )[0];
  const sched: ScheduleSettings = {
    closeDay: s?.closeDay ?? "Sunday",
    closeTime: s?.closeTime ?? "20:00",
    openDay: s?.openDay ?? "Monday",
    openTime: s?.openTime ?? "01:00",
    timezone: s?.timezone ?? "Europe/London",
  };
  const locked =
    instance.status === "locked" || isPeriodClosed(period, periodIso, sched);

  const subtitle =
    period === "week"
      ? `Weekly update · ${weekLabel(parseISODate(periodIso))}`
      : `${period === "month" ? "Monthly" : "Quarterly"} update · ${periodLabel(period, periodIso)} (${periodRange(period, periodIso)})`;

  return (
    <Screen title={template.name} subtitle={subtitle}>
      <ReportForm
        instanceId={instance.id}
        templateId={templateId}
        locked={locked}
        questions={qs.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          config: q.config,
        }))}
        initialValues={initialValues}
      />
    </Screen>
  );
}
