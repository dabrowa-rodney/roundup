import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { teamMembers, teams, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { canManageTeam, type TeamAuthority } from "@/lib/team-authority";
import { getTeamAuthority } from "@/lib/teams";

const NO_AUTHORITY =
  "You can only change the members of a team you lead — ask an admin or that team's lead.";

async function orgTeam(teamId: number, orgId: number) {
  return (
    await db
      .select({ id: teams.id, parentTeamId: teams.parentTeamId })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)))
      .limit(1)
  )[0];
}

/** Is `userId` currently a lead of this team? */
async function isLeadOf(teamId: number, userId: number): Promise<boolean> {
  return (
    (
      await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
            eq(teamMembers.role, "lead"),
          ),
        )
        .limit(1)
    ).length > 0
  );
}

/** Does the team still have a lead other than `userId`? */
async function hasAnotherLead(teamId: number, userId: number): Promise<boolean> {
  return (
    (
      await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.role, "lead"),
            ne(teamMembers.userId, userId),
          ),
        )
        .limit(1)
    ).length > 0
  );
}

/**
 * Guard the two ways a lead role can be taken away — demotion (POST with
 * role 'member') and removal (DELETE) — for the cases that would break
 * something:
 *
 *   • A non-admin can't strip their OWN lead role. It's the source of their
 *     authority over the subtree, so this is the same rule as "a lead can't
 *     archive their own team": only a parent's lead or an admin can.
 *   • Nobody can leave a SUB-team with no lead at all. A leaderless sub-team's
 *     roundup resolves to zero default recipients, so it silently goes nowhere.
 *     Appoint the replacement first, then remove the outgoing lead. The root
 *     team is exempt — its audience comes from org roles, not team leads.
 *
 * Returns an error message to refuse with, or null to proceed.
 */
async function leadRemovalBlock(
  auth: TeamAuthority,
  team: { id: number; parentTeamId: number | null },
  callerId: number,
  userId: number,
): Promise<string | null> {
  if (!(await isLeadOf(team.id, userId))) return null;

  if (!auth.isOrgAdmin && userId === callerId) {
    return "You can't give up your own lead role for this team — an admin or your parent team's lead has to do it.";
  }
  if (team.parentTeamId !== null && !(await hasAnotherLead(team.id, userId))) {
    return "This is the team's only lead. Appoint another lead first, then remove them — a team with no lead has nobody to send its Roundup to.";
  }
  return null;
}

// POST /api/teams/[id]/members  { userId, role? } — add a member (or change
// their role). role: 'lead' | 'member'. Needs canManageTeam on this team (D3),
// so a lead can staff their own subtree. Appointing a co-lead is allowed: it
// hands out authority over a subtree the caller already manages, so it can't
// be used to escalate beyond themselves. Demoting an existing lead goes through
// leadRemovalBlock. A person can belong to many teams; this only touches THIS
// team's row.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }
  const team = await orgTeam(teamId, me.orgId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  const auth = await getTeamAuthority(me.orgId, me.id, me.role);
  if (!canManageTeam(auth, teamId)) {
    return NextResponse.json({ error: NO_AUTHORITY }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }
  const user = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, me.orgId)))
      .limit(1)
  )[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const role = body.role === "lead" ? "lead" : "member";

  // Demoting a lead is a lead removal — same guards as DELETE.
  if (role !== "lead") {
    const blocked = await leadRemovalBlock(auth, team, me.id, userId);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 409 });
    }
  }

  await db
    .insert(teamMembers)
    .values({ teamId, userId, role })
    .onConflictDoUpdate({
      target: [teamMembers.teamId, teamMembers.userId],
      set: { role },
    });

  return NextResponse.json({ ok: true, teamId, userId, role });
}

// DELETE /api/teams/[id]/members?userId=N — remove a member from this team.
// Needs canManageTeam on this team (D3), and passes leadRemovalBlock if the
// member is a lead. Their reports and other team memberships are untouched.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = parseInt(id, 10);
  const userId = parseInt(req.nextUrl.searchParams.get("userId") ?? "", 10);
  if (isNaN(teamId) || isNaN(userId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const team = await orgTeam(teamId, me.orgId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  const auth = await getTeamAuthority(me.orgId, me.id, me.role);
  if (!canManageTeam(auth, teamId)) {
    return NextResponse.json({ error: NO_AUTHORITY }, { status: 403 });
  }
  const blocked = await leadRemovalBlock(auth, team, me.id, userId);
  if (blocked) {
    return NextResponse.json({ error: blocked }, { status: 409 });
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  return NextResponse.json({ ok: true });
}
