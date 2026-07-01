import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { answers, reportInstances, settings, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { isWeekClosed, type ScheduleSettings } from "@/lib/lifecycle";

// PATCH /api/instances/[id] — save answers (autosave / draft) or submit.
// Owner-only. Rejected once the instance is locked.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const instanceId = parseInt(id, 10);
  if (isNaN(instanceId)) {
    return NextResponse.json({ error: "Invalid instance ID" }, { status: 400 });
  }

  const me = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email.toLowerCase()))
      .limit(1)
  )[0];
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (instance.userId !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settingsRow = (await db.select().from(settings).limit(1))[0];
  const sched: ScheduleSettings = {
    closeDay: settingsRow?.closeDay ?? "Sunday",
    closeTime: settingsRow?.closeTime ?? "20:00",
    openDay: settingsRow?.openDay ?? "Monday",
    openTime: settingsRow?.openTime ?? "01:00",
    timezone: settingsRow?.timezone ?? "Europe/London",
  };
  if (instance.status === "locked" || isWeekClosed(instance.weekStart, sched)) {
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
