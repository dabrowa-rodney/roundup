import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reportTemplates, reportAssignees, users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSessionUser, type SessionUser } from "@/lib/session";

/** The template, only if it belongs to the caller's org. */
async function ownedTemplate(me: SessionUser, templateId: number) {
  const rows = await db
    .select({ id: reportTemplates.id })
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, templateId),
        eq(reportTemplates.orgId, me.orgId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// PATCH /api/templates/[id] — update template name, area, data source, assignees
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
  }
  if (!(await ownedTemplate(me, templateId))) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.area !== undefined) updates.area = body.area?.trim() || null;
  if (body.cadence !== undefined) updates.cadence = body.cadence;
  if (body.dataSourceUrl !== undefined) updates.dataSourceUrl = body.dataSourceUrl?.trim() || null;

  // Handle assignees update — only users from the caller's own org.
  if (body.assigneeIds !== undefined) {
    const ids: number[] = Array.isArray(body.assigneeIds)
      ? body.assigneeIds.filter((n: unknown) => Number.isInteger(n))
      : [];
    const valid = ids.length
      ? await db
          .select({ id: users.id })
          .from(users)
          .where(and(inArray(users.id, ids), eq(users.orgId, me.orgId)))
      : [];

    await db
      .delete(reportAssignees)
      .where(eq(reportAssignees.templateId, templateId));

    if (valid.length > 0) {
      await db.insert(reportAssignees).values(
        valid.map((u) => ({
          templateId,
          userId: u.id,
        }))
      );
    }
  }

  if (Object.keys(updates).length > 0) {
    const updated = await db
      .update(reportTemplates)
      .set(updates)
      .where(
        and(
          eq(reportTemplates.id, templateId),
          eq(reportTemplates.orgId, me.orgId),
        ),
      )
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template: updated[0] });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/templates/[id] — soft-delete (archive) a template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
  }

  const updated = await db
    .update(reportTemplates)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(reportTemplates.id, templateId),
        eq(reportTemplates.orgId, me.orgId),
      ),
    )
    .returning();

  if (!updated.length) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
