import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { teamMembers, teams, users } from "@/db/schema";
import { getOrgPlan } from "@/lib/org-plan";
import { getSessionUser } from "@/lib/session";
import {
  canArchiveTeam,
  canCreateSubTeam,
  canManageTeam,
} from "@/lib/team-authority";
import {
  ensureRootTeam,
  getTeamAuthority,
  teamDepth,
  MAX_TEAM_DEPTH,
  type RollupMode,
  type TeamCadence,
  type TemplateMode,
} from "@/lib/teams";

const CADENCES: TeamCadence[] = ["weekly", "monthly", "quarterly"];
const ROLLUPS: RollupMode[] = ["members", "children", "both"];
const TEMPLATE_MODES: TemplateMode[] = ["shared", "per_member"];

// GET /api/teams — the caller's org's team tree with members.
// Any member may read it (it powers grouping everywhere, not just the builder).
// Each team carries the caller's rights for it so the UI can render controls
// per team (D3) instead of assuming the caller is an org admin:
//   canManage  — rename, configure, staff, nest below, drive its Roundup
//   canArchive — archive/restore, and (same predicate) act as the SOURCE of a
//                move; a lead's own team is excluded. A move's DESTINATION just
//                needs canManage, so the picker filters targets on that.
export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureRootTeam(me.orgId);

  const auth = await getTeamAuthority(me.orgId, me.id, me.role);

  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.orgId, me.orgId))
    .orderBy(asc(teams.createdAt));

  const memberRows = teamRows.length
    ? await db
        .select({
          teamId: teamMembers.teamId,
          role: teamMembers.role,
          userId: users.id,
          name: users.name,
          email: users.email,
          avatarColor: users.avatarColor,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(
          inArray(
            teamMembers.teamId,
            teamRows.map((t) => t.id),
          ),
        )
    : [];

  const membersByTeam = new Map<number, typeof memberRows>();
  for (const m of memberRows) {
    const list = membersByTeam.get(m.teamId) ?? [];
    list.push(m);
    membersByTeam.set(m.teamId, list);
  }

  return NextResponse.json({
    teams: teamRows.map((t) => ({
      id: t.id,
      parentTeamId: t.parentTeamId,
      name: t.name,
      cadence: t.cadence,
      rollupMode: t.rollupMode,
      templateMode: t.templateMode,
      archivedAt: t.archivedAt,
      canManage: canManageTeam(auth, t.id),
      canArchive: canArchiveTeam(auth, t.id),
      members: (membersByTeam.get(t.id) ?? []).map((m) => ({
        id: m.userId,
        name: m.name,
        email: m.email,
        avatarColor: m.avatarColor,
        role: m.role,
      })),
    })),
  });
}

// POST /api/teams — create a sub-team. Org admins anywhere; a team lead may
// only nest below a team they manage (D3).
// { name, parentTeamId, cadence?, rollupMode?, templateMode? }
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Plan gate: nested teams are a Business feature (D5).
  const plan = await getOrgPlan(me.orgId);
  if (!plan.limits.nestedTeams) {
    return NextResponse.json(
      {
        error: `Teams inside teams are a Business feature — upgrade in Settings to structure your organisation.`,
      },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Team name must be 2–60 characters" },
      { status: 400 },
    );
  }

  const parentTeamId = Number(body.parentTeamId);
  if (!Number.isInteger(parentTeamId)) {
    return NextResponse.json(
      { error: "A parent team is required" },
      { status: 400 },
    );
  }
  const parent = (
    await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, parentTeamId), eq(teams.orgId, me.orgId)))
      .limit(1)
  )[0];
  if (!parent) {
    return NextResponse.json({ error: "Parent team not found" }, { status: 404 });
  }

  // Authority is checked only once the parent is known to be in this org, so a
  // foreign id keeps 404-ing rather than leaking its existence via a 403.
  const auth = await getTeamAuthority(me.orgId, me.id, me.role);
  if (!canCreateSubTeam(auth, parentTeamId)) {
    return NextResponse.json(
      {
        error:
          "You can only create teams inside a team you lead — ask an admin or that team's lead.",
      },
      { status: 403 },
    );
  }

  const cadence = CADENCES.includes(body.cadence) ? body.cadence : "weekly";
  const rollupMode = ROLLUPS.includes(body.rollupMode)
    ? body.rollupMode
    : "members";
  // 'shared' template mode isn't implemented yet (it wouldn't materialize any
  // report instances) — only per-member is offered.
  if (body.templateMode === "shared") {
    return NextResponse.json(
      { error: "Shared templates aren't available yet" },
      { status: 400 },
    );
  }
  const templateMode = TEMPLATE_MODES.includes(body.templateMode)
    ? body.templateMode
    : "per_member";

  // Depth guard: the new team sits one below its parent.
  const allTeams = await db
    .select({ id: teams.id, parentTeamId: teams.parentTeamId })
    .from(teams)
    .where(eq(teams.orgId, me.orgId));
  if (teamDepth(allTeams, parentTeamId) + 1 > MAX_TEAM_DEPTH) {
    return NextResponse.json(
      { error: `Teams can nest at most ${MAX_TEAM_DEPTH} levels deep` },
      { status: 400 },
    );
  }

  const inserted = await db
    .insert(teams)
    .values({
      orgId: me.orgId,
      parentTeamId,
      name,
      cadence,
      rollupMode,
      templateMode,
    })
    .returning();

  return NextResponse.json({ team: inserted[0] }, { status: 201 });
}
