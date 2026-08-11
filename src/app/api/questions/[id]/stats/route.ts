import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { questions, reportTemplates, teams } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { loadAssignedTemplateIds } from "@/lib/assignees";
import { parseConfig, questionSheetUrl } from "@/lib/questions";
import { fetchSheetPreview } from "@/lib/sheets";

// GET /api/questions/[id]/stats — the metrics from the Google Sheet attached
// to THIS question, for the person filling in the report. Shown above the
// answer box so they can write narrative around the numbers.
//
// The sheet URL comes from the STORED question config, never from the caller —
// this is what keeps the endpoint from becoming an open sheet-fetching proxy
// (the admin-only /api/sheets/preview exists for testing arbitrary links).
// Access mirrors the report form itself: admins, plus anyone who owes the
// template (explicit assignee, or member of a team that shares its templates).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const questionId = parseInt(id, 10);
  if (isNaN(questionId)) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400 });
  }

  // The question, org-scoped through its template; archived surfaces excluded
  // the same way the report form excludes them.
  const row = (
    await db
      .select({
        config: questions.config,
        templateId: reportTemplates.id,
      })
      .from(questions)
      .innerJoin(reportTemplates, eq(questions.templateId, reportTemplates.id))
      .innerJoin(teams, eq(reportTemplates.teamId, teams.id))
      .where(
        and(
          eq(questions.id, questionId),
          eq(reportTemplates.orgId, me.orgId),
          isNull(questions.archivedAt),
          isNull(reportTemplates.archivedAt),
          isNull(teams.archivedAt),
        ),
      )
      .limit(1)
  )[0];
  if (!row) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  if (me.role !== "admin") {
    const owed = await loadAssignedTemplateIds(me.orgId, me.id);
    if (!owed.includes(row.templateId)) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
  }

  const url = questionSheetUrl(parseConfig(row.config));
  if (!url) {
    // No sheet on this question — nothing to show. Distinct from a broken
    // sheet so the client can simply render nothing.
    return NextResponse.json({ ok: false, reason: "no_sheet", metrics: [] });
  }

  return NextResponse.json(await fetchSheetPreview(url));
}
