import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, asc, eq, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  answers,
  questions,
  reportAssignees,
  reportInstances,
  reportTemplates,
  settings,
  users,
} from "@/db/schema";
import { Screen } from "@/components/screen";
import { ReportForm } from "@/components/report-form";
import { mondayISO, parseISODate, weekLabel } from "@/lib/dates";
import { isWeekClosed, type ScheduleSettings } from "@/lib/lifecycle";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId)) notFound();

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/login");

  const me = (
    await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
  )[0];
  if (!me) redirect("/login");

  const template = (
    await db
      .select()
      .from(reportTemplates)
      .where(
        and(
          eq(reportTemplates.id, templateId),
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

  const weekIso = mondayISO(new Date());

  // Get-or-create this week's instance for the current user.
  await db
    .insert(reportInstances)
    .values({
      templateId,
      userId: me.id,
      weekStart: weekIso,
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
          eq(reportInstances.weekStart, weekIso),
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
  const s = (await db.select().from(settings).limit(1))[0];
  const sched: ScheduleSettings = {
    closeDay: s?.closeDay ?? "Sunday",
    closeTime: s?.closeTime ?? "20:00",
    openDay: s?.openDay ?? "Monday",
    openTime: s?.openTime ?? "01:00",
    timezone: s?.timezone ?? "Europe/London",
  };
  const locked = instance.status === "locked" || isWeekClosed(weekIso, sched);

  return (
    <Screen
      title={template.name}
      subtitle={`Weekly update · ${weekLabel(parseISODate(weekIso))}`}
    >
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
