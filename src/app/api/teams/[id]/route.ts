import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { getOrgPlan } from "@/lib/org-plan";
import { getSessionUser } from "@/lib/session";
import {
  collectSubtreeIds,
  teamDepth,
  wouldCreateCycle,
  MAX_TEAM_DEPTH,
  type RollupMode,
  type TeamCadence,
  type TemplateMode,
} from "@/lib/teams";

const CADENCES: TeamCadence[] = ["weekly", "monthly", "quarterly"];
const ROLLUPS: RollupMode[] = ["members", "children", "both"];
const TEMPLATE_MODES: TemplateMode[] = ["shared", "per_member"];

// PATCH /api/teams/[id] — rename, re-parent, reconfigure, archive/restore.
// Admin-only. The root team cannot be re-parented or archived. Archiving is
// subtree-wide (a team's children go with it); restore is subtree-wide too.
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
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }

  const team = (
    await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.orgId, me.orgId)))
      .limit(1)
  )[0];
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  const isRoot = team.parentTeamId === null;

  const body = await req.json().catch(() => ({}));
  const set: Partial<typeof teams.$inferInsert> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 60) {
      return NextResponse.json(
        { error: "Team name must be 2–60 characters" },
        { status: 400 },
      );
    }
    set.name = name;
  }

  if (body.cadence !== undefined) {
    if (!CADENCES.includes(body.cadence)) {
      return NextResponse.json({ error: "Invalid cadence" }, { status: 400 });
    }
    // Plan gate: monthly/quarterly cadences ship with nested teams (D5).
    if (body.cadence !== "weekly") {
      const plan = await getOrgPlan(me.orgId);
      if (!plan.limits.nestedTeams) {
        return NextResponse.json(
          {
            error:
              "Monthly and quarterly roundups are a Business feature — upgrade in Settings to switch cadence.",
          },
          { status: 403 },
        );
      }
    }
    set.cadence = body.cadence;
  }
  if (body.rollupMode !== undefined) {
    if (!ROLLUPS.includes(body.rollupMode)) {
      return NextResponse.json({ error: "Invalid rollup mode" }, { status: 400 });
    }
    set.rollupMode = body.rollupMode;
  }
  if (body.templateMode !== undefined) {
    if (!TEMPLATE_MODES.includes(body.templateMode)) {
      return NextResponse.json(
        { error: "Invalid template mode" },
        { status: 400 },
      );
    }
    set.templateMode = body.templateMode;
  }

  // Re-parenting: never the root; never onto itself/descendants (cycle);
  // never beyond the depth ceiling (checked for the DEEPEST node moved).
  const allTeams = await db
    .select({ id: teams.id, parentTeamId: teams.parentTeamId })
    .from(teams)
    .where(eq(teams.orgId, me.orgId));

  if (body.parentTeamId !== undefined) {
    if (isRoot) {
      return NextResponse.json(
        { error: "The root team cannot be moved" },
        { status: 400 },
      );
    }
    const newParentId = Number(body.parentTeamId);
    if (!Number.isInteger(newParentId)) {
      return NextResponse.json({ error: "Invalid parent team" }, { status: 400 });
    }
    const parent = allTeams.find((t) => t.id === newParentId);
    if (!parent) {
      return NextResponse.json({ error: "Parent team not found" }, { status: 404 });
    }
    if (wouldCreateCycle(allTeams, teamId, newParentId)) {
      return NextResponse.json(
        { error: "A team cannot sit inside its own subtree" },
        { status: 400 },
      );
    }
    // Depth of the moved subtree's deepest node at its new position.
    const subtree = collectSubtreeIds(allTeams, teamId);
    const subtreeDepth = Math.max(
      ...subtree.map((sid) => teamDepth(allTeams, sid)),
    );
    const currentDepth = teamDepth(allTeams, teamId);
    const newDepth = teamDepth(allTeams, newParentId) + 1;
    if (newDepth + (subtreeDepth - currentDepth) > MAX_TEAM_DEPTH) {
      return NextResponse.json(
        { error: `Teams can nest at most ${MAX_TEAM_DEPTH} levels deep` },
        { status: 400 },
      );
    }
    set.parentTeamId = newParentId;
  }

  // Archive / restore — subtree-wide.
  if (body.archived !== undefined) {
    if (isRoot) {
      return NextResponse.json(
        { error: "The root team cannot be archived" },
        { status: 400 },
      );
    }
    const subtreeIds = collectSubtreeIds(allTeams, teamId);
    if (body.archived === true) {
      await db
        .update(teams)
        .set({ archivedAt: new Date() })
        .where(and(inArray(teams.id, subtreeIds), eq(teams.orgId, me.orgId)));
    } else {
      await db
        .update(teams)
        .set({ archivedAt: null })
        .where(
          and(
            inArray(teams.id, subtreeIds),
            eq(teams.orgId, me.orgId),
            isNotNull(teams.archivedAt),
          ),
        );
    }
  }

  if (Object.keys(set).length > 0) {
    await db
      .update(teams)
      .set(set)
      .where(and(eq(teams.id, teamId), eq(teams.orgId, me.orgId)));
  }

  const updated = (
    await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  )[0];
  return NextResponse.json({ team: updated });
}
