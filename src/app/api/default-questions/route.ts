import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { defaultQuestions } from "@/db/schema";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { cleanQuestionConfig, VALID_QUESTION_TYPES } from "@/lib/questions";

// Org-wide default questions: copied into every NEW report template at
// creation (POST /api/templates), after which the copies are ordinary
// questions — editable and deletable per report. Changing or deleting a
// default never touches existing reports.
//
// The request/response contract deliberately mirrors
// /api/templates/[id]/questions (POST {text,type,config}; PATCH {questionId,…}
// | {reorder:[ids]} | {archiveQuestionId}) so the Reports screen drives both
// with the same QuestionModal. The one divergence: "archiving" a default is a
// hard DELETE — defaults are a source to copy from, not a record, and the
// copies in existing reports carry any history that matters.

function forbidden(me: SessionUser | null): NextResponse | null {
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// GET /api/default-questions — the caller's org's defaults, in display order.
export async function GET() {
  const me = await getSessionUser();
  const halt = forbidden(me);
  if (halt) return halt;

  const qs = await db
    .select()
    .from(defaultQuestions)
    .where(eq(defaultQuestions.orgId, me!.orgId))
    .orderBy(asc(defaultQuestions.order));

  return NextResponse.json({ questions: qs });
}

// POST /api/default-questions — add a default question.
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  const halt = forbidden(me);
  if (halt) return halt;

  const body = await req.json().catch(() => ({}));
  const { text, type, config } = body;

  if (!text || !type) {
    return NextResponse.json(
      { error: "Text and type are required" },
      { status: 400 },
    );
  }
  if (!VALID_QUESTION_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${VALID_QUESTION_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  const cleaned = cleanQuestionConfig(config);
  if (cleaned.error) {
    return NextResponse.json({ error: cleaned.error }, { status: 400 });
  }

  const existing = await db
    .select({ order: defaultQuestions.order })
    .from(defaultQuestions)
    .where(eq(defaultQuestions.orgId, me!.orgId))
    .orderBy(asc(defaultQuestions.order));
  const order =
    existing.length > 0 ? existing[existing.length - 1].order + 1 : 0;

  const inserted = await db
    .insert(defaultQuestions)
    .values({
      orgId: me!.orgId,
      text: String(text).trim(),
      type,
      config: cleaned.config,
      order,
    })
    .returning();

  return NextResponse.json({ question: inserted[0] }, { status: 201 });
}

// PATCH /api/default-questions — update, reorder, or remove. Every write is
// scoped to the caller's org, so a foreign id is a no-op.
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser();
  const halt = forbidden(me);
  if (halt) return halt;

  const body = await req.json().catch(() => ({}));

  // Reorder: { reorder: [id, ...] } — ids in their new display order.
  if (Array.isArray(body.reorder)) {
    const ids = body.reorder.filter((x: unknown) => Number.isInteger(x));
    if (ids.length === 0) {
      return NextResponse.json({ error: "Nothing to reorder" }, { status: 400 });
    }
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(defaultQuestions)
        .set({ order: i })
        .where(
          and(
            eq(defaultQuestions.id, ids[i]),
            eq(defaultQuestions.orgId, me!.orgId),
          ),
        );
    }
    return NextResponse.json({ success: true });
  }

  // Single update: { questionId, text?, type?, config? }
  if (body.questionId) {
    const updates: Record<string, unknown> = {};
    if (body.text !== undefined) updates.text = String(body.text).trim();
    if (body.type !== undefined) {
      if (!VALID_QUESTION_TYPES.includes(body.type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${VALID_QUESTION_TYPES.join(", ")}` },
          { status: 400 },
        );
      }
      updates.type = body.type;
    }
    if (body.config !== undefined) {
      const cleaned = cleanQuestionConfig(body.config);
      if (cleaned.error) {
        return NextResponse.json({ error: cleaned.error }, { status: 400 });
      }
      updates.config = cleaned.config;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(defaultQuestions)
        .set(updates)
        .where(
          and(
            eq(defaultQuestions.id, body.questionId),
            eq(defaultQuestions.orgId, me!.orgId),
          ),
        );
    }
    return NextResponse.json({ success: true });
  }

  // Remove: { archiveQuestionId } — a hard delete here (see header note).
  if (body.archiveQuestionId) {
    await db
      .delete(defaultQuestions)
      .where(
        and(
          eq(defaultQuestions.id, body.archiveQuestionId),
          eq(defaultQuestions.orgId, me!.orgId),
        ),
      );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
