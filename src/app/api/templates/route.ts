import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reportTemplates, reportAssignees, questions, teams, users } from "@/db/schema";
import { and, eq, isNull, sql, asc, inArray } from "drizzle-orm";
import { getOrgPlan } from "@/lib/org-plan";
import { getSessionUser } from "@/lib/session";
import { ensureRootTeam } from "@/lib/teams";

// GET /api/templates — the caller's org's templates with question counts + assignees
export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Everything not yet purged — active, archived, and recently deleted.
  // Clients split on archivedAt/deletedAt; the deleted group is what the
  // 7-day "restore" window shows.
  const templates = await db
    .select()
    .from(reportTemplates)
    .where(eq(reportTemplates.orgId, me.orgId))
    .orderBy(asc(reportTemplates.name));
  const templateIds = templates.map((t) => t.id);

  // Question counts per template (non-archived).
  const qCounts = templateIds.length
    ? await db
        .select({
          templateId: questions.templateId,
          count: sql<number>`count(*)::int`,
        })
        .from(questions)
        .where(
          and(
            isNull(questions.archivedAt),
            inArray(questions.templateId, templateIds),
          ),
        )
        .groupBy(questions.templateId)
    : [];

  const countMap = new Map(qCounts.map((q) => [q.templateId, q.count]));

  // Assignees per template.
  const assignees = templateIds.length
    ? await db
        .select({
          templateId: reportAssignees.templateId,
          userId: reportAssignees.userId,
          userName: users.name,
          userEmail: users.email,
        })
        .from(reportAssignees)
        .innerJoin(users, eq(reportAssignees.userId, users.id))
        .where(inArray(reportAssignees.templateId, templateIds))
    : [];

  const assigneeMap = new Map<number, { id: number; name: string | null; email: string }[]>();
  for (const a of assignees) {
    const list = assigneeMap.get(a.templateId) || [];
    list.push({ id: a.userId, name: a.userName, email: a.userEmail });
    assigneeMap.set(a.templateId, list);
  }

  const result = templates.map((t) => ({
    ...t,
    qCount: countMap.get(t.id) || 0,
    assignees: assigneeMap.get(t.id) || [],
  }));

  return NextResponse.json({ templates: result });
}

// POST /api/templates — create a new report template in the caller's org
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Plan gate: active-template cap.
  const plan = await getOrgPlan(me.orgId);
  if (Number.isFinite(plan.limits.maxTemplates)) {
    const active = await db
      .select({ id: reportTemplates.id })
      .from(reportTemplates)
      .where(
        and(
          eq(reportTemplates.orgId, me.orgId),
          isNull(reportTemplates.archivedAt),
        ),
      );
    if (active.length >= plan.limits.maxTemplates) {
      return NextResponse.json(
        {
          error: `The ${plan.limits.label} plan includes ${plan.limits.maxTemplates} report template${plan.limits.maxTemplates === 1 ? "" : "s"} — upgrade in Settings to add more.`,
        },
        { status: 403 },
      );
    }
  }

  const body = await req.json();
  const { name, area, cadence, dataSourceUrl } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Templates belong to a team. An explicit body.teamId must be an integer
  // and belong to the caller's org; absent one, default to the root team.
  let teamId: number;
  if (body.teamId !== undefined && body.teamId !== null) {
    const owned = Number.isInteger(body.teamId)
      ? await db
          .select({ id: teams.id })
          .from(teams)
          .where(and(eq(teams.id, body.teamId), eq(teams.orgId, me.orgId)))
          .limit(1)
      : [];
    if (owned.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    teamId = body.teamId;
  } else {
    teamId = await ensureRootTeam(me.orgId);
  }

  const inserted = await db
    .insert(reportTemplates)
    .values({
      orgId: me.orgId,
      teamId,
      name: name.trim(),
      area: area?.trim() || null,
      cadence: cadence || "weekly",
      dataSourceUrl: dataSourceUrl?.trim() || null,
    })
    .returning();

  return NextResponse.json({ template: inserted[0] }, { status: 201 });
}
