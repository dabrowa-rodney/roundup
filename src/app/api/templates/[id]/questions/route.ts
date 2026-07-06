import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, reportTemplates } from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getSessionUser, type SessionUser } from "@/lib/session";

/** True if the template belongs to the caller's org. */
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
  return rows.length > 0;
}

// GET /api/templates/[id]/questions — list questions for a template
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
  }
  if (!(await ownedTemplate(me, templateId))) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const qs = await db
    .select()
    .from(questions)
    .where(and(eq(questions.templateId, templateId), isNull(questions.archivedAt)))
    .orderBy(asc(questions.order));

  return NextResponse.json({ questions: qs });
}

const VALID_TYPES = [
  "rag",
  "long_text",
  "short_text",
  "single_choice",
  "multi_choice",
  "number",
  "file_link",
];

// POST /api/templates/[id]/questions — add a question to a template
export async function POST(
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
  const { text, type, config, order } = body;

  if (!text || !type) {
    return NextResponse.json({ error: "Text and type are required" }, { status: 400 });
  }

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  // Auto-assign order if not provided
  let questionOrder = order;
  if (questionOrder === undefined) {
    const existing = await db
      .select({ order: questions.order })
      .from(questions)
      .where(and(eq(questions.templateId, templateId), isNull(questions.archivedAt)))
      .orderBy(asc(questions.order));
    questionOrder = existing.length > 0 ? existing[existing.length - 1].order + 1 : 0;
  }

  const inserted = await db
    .insert(questions)
    .values({
      templateId,
      text: text.trim(),
      type,
      config: config || null,
      order: questionOrder,
    })
    .returning();

  return NextResponse.json({ question: inserted[0] }, { status: 201 });
}

// PATCH /api/templates/[id]/questions — update or archive a question (scoped to
// this template so an admin can't mutate another template's questions by id).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  // Reorder: { reorder: [questionId, ...] } — ids in their new display order.
  // Each update is scoped to this template, so foreign ids are no-ops.
  if (Array.isArray(body.reorder)) {
    const ids = body.reorder.filter((x: unknown) => Number.isInteger(x));
    if (ids.length === 0) {
      return NextResponse.json({ error: "Nothing to reorder" }, { status: 400 });
    }
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(questions)
        .set({ order: i })
        .where(
          and(eq(questions.id, ids[i]), eq(questions.templateId, templateId)),
        );
    }
    return NextResponse.json({ success: true });
  }

  // Single question update: { questionId, text?, type?, config?, order? }
  if (body.questionId) {
    const updates: Record<string, unknown> = {};
    if (body.text !== undefined) updates.text = body.text.trim();
    if (body.type !== undefined) {
      if (!VALID_TYPES.includes(body.type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
          { status: 400 },
        );
      }
      updates.type = body.type;
    }
    if (body.config !== undefined) updates.config = body.config;
    if (body.order !== undefined) updates.order = body.order;

    if (Object.keys(updates).length > 0) {
      await db
        .update(questions)
        .set(updates)
        .where(
          and(
            eq(questions.id, body.questionId),
            eq(questions.templateId, templateId),
          ),
        );
    }

    return NextResponse.json({ success: true });
  }

  // Archive a question: { archiveQuestionId }
  if (body.archiveQuestionId) {
    await db
      .update(questions)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(questions.id, body.archiveQuestionId),
          eq(questions.templateId, templateId),
        ),
      );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
