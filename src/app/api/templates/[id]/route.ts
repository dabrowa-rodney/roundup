import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { reportTemplates, reportAssignees, users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Helper: check admin
async function requireAdmin(email: string) {
  const caller = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return caller.length > 0 && caller[0].role === "admin";
}

// PATCH /api/templates/[id] — update template name, area, data source, etc.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requireAdmin(session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.area !== undefined) updates.area = body.area?.trim() || null;
  if (body.cadence !== undefined) updates.cadence = body.cadence;
  if (body.dataSourceUrl !== undefined) updates.dataSourceUrl = body.dataSourceUrl?.trim() || null;

  // Handle assignees update
  if (body.assigneeIds !== undefined) {
    // Remove existing assignees
    await db
      .delete(reportAssignees)
      .where(eq(reportAssignees.templateId, templateId));

    // Add new ones
    if (Array.isArray(body.assigneeIds) && body.assigneeIds.length > 0) {
      await db.insert(reportAssignees).values(
        body.assigneeIds.map((userId: number) => ({
          templateId,
          userId,
        }))
      );
    }
  }

  if (Object.keys(updates).length > 0) {
    const updated = await db
      .update(reportTemplates)
      .set(updates)
      .where(eq(reportTemplates.id, templateId))
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requireAdmin(session.user.email))) {
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
    .where(eq(reportTemplates.id, templateId))
    .returning();

  if (!updated.length) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
