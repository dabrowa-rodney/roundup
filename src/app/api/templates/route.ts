import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { reportTemplates, reportAssignees, questions, users } from "@/db/schema";
import { eq, isNull, sql, asc } from "drizzle-orm";

// GET /api/templates — list all report templates with question counts and assignees
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await db
    .select()
    .from(reportTemplates)
    .where(isNull(reportTemplates.archivedAt))
    .orderBy(asc(reportTemplates.name));

  // Get question counts per template (non-archived)
  const qCounts = await db
    .select({
      templateId: questions.templateId,
      count: sql<number>`count(*)::int`,
    })
    .from(questions)
    .where(isNull(questions.archivedAt))
    .groupBy(questions.templateId);

  const countMap = new Map(qCounts.map((q) => [q.templateId, q.count]));

  // Get assignees per template
  const assignees = await db
    .select({
      templateId: reportAssignees.templateId,
      userId: reportAssignees.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(reportAssignees)
    .innerJoin(users, eq(reportAssignees.userId, users.id));

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

// POST /api/templates — create a new report template
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin
  const caller = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, session.user.email.toLowerCase()))
    .limit(1);

  if (!caller.length || caller[0].role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, area, cadence, dataSourceUrl } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const inserted = await db
    .insert(reportTemplates)
    .values({
      name: name.trim(),
      area: area?.trim() || null,
      cadence: cadence || "weekly",
      dataSourceUrl: dataSourceUrl?.trim() || null,
    })
    .returning();

  return NextResponse.json({ template: inserted[0] }, { status: 201 });
}
