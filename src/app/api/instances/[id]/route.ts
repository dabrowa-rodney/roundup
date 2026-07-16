import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { answers, reportInstances, reportTemplates, settings, teams } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { isPeriodClosed, type ScheduleSettings } from "@/lib/lifecycle";
import { periodForCadence } from "@/lib/dates";
import { getSessionUser } from "@/lib/session";

// PATCH /api/instances/[id] — save answers (autosave / draft) or submit.
// Owner-only. Rejected once the instance is locked.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const instanceId = parseInt(id, 10);
  if (isNaN(instanceId)) {
    return NextResponse.json({ error: "Invalid instance ID" }, { status: 400 });
  }

  const instance = (
    await db
      .select()
      .from(reportInstances)
      .where(eq(reportInstances.id, instanceId))
      .limit(1)
  )[0];
  if (!instance) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (instance.userId !== me.id || instance.orgId !== me.orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settingsRow = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.orgId, me.orgId))
      .limit(1)
  )[0];
  const sched: ScheduleSettings = {
    closeDay: settingsRow?.closeDay ?? "Sunday",
    closeTime: settingsRow?.closeTime ?? "20:00",
    openDay: settingsRow?.openDay ?? "Monday",
    openTime: settingsRow?.openTime ?? "01:00",
    timezone: settingsRow?.timezone ?? "Europe/London",
  };
  // The instance's period follows its template's TEAM cadence — a monthly
  // team's report stays editable all month, not just its first week.
  const teamRow = (
    await db
      .select({ cadence: teams.cadence })
      .from(reportTemplates)
      .innerJoin(teams, eq(reportTemplates.teamId, teams.id))
      .where(eq(reportTemplates.id, instance.templateId))
      .limit(1)
  )[0];
  const period = periodForCadence(teamRow?.cadence ?? "weekly");
  if (
    instance.status === "locked" ||
    isPeriodClosed(period, instance.weekStart, sched)
  ) {
    return NextResponse.json(
      { error: "This report is locked and can no longer be edited." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const submit = body.submit === true;
  const incoming: { questionId: number; value: unknown; attachments?: unknown }[] =
    Array.isArray(body.answers) ? body.answers : [];

  // Upsert answers (unique on instance_id + question_id)
  if (incoming.length > 0) {
    const rows = incoming
      .filter((a) => typeof a.questionId === "number")
      .map((a) => ({
        instanceId,
        questionId: a.questionId,
        value: (a.value ?? null) as unknown,
        attachments: (a.attachments ?? null) as unknown,
      }));

    if (rows.length > 0) {
      await db
        .insert(answers)
        .values(rows)
        .onConflictDoUpdate({
          target: [answers.instanceId, answers.questionId],
          set: {
            value: sql`excluded.value`,
            attachments: sql`excluded.attachments`,
            updatedAt: new Date(),
          },
        });
    }
  }

  // Advance instance status
  const now = new Date();
  const nextStatus = submit
    ? "submitted"
    : instance.status === "not_started"
      ? "in_progress"
      : instance.status;

  await db
    .update(reportInstances)
    .set({
      status: nextStatus,
      updatedAt: now,
      ...(submit ? { submittedAt: now } : {}),
    })
    .where(eq(reportInstances.id, instanceId));

  return NextResponse.json({ ok: true, status: nextStatus });
}
