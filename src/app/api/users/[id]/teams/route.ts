import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { teamMembers, teams, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { diffTeamMembership } from "@/lib/teams";

// PUT /api/users/[id]/teams  { teamIds: number[] }
// Admin-only. Sets which teams a user belongs to in one call — the primary,
// obvious way to put people on teams (the per-team builder still works too).
// Reconciles: adds newly-checked teams (as 'member'), removes unchecked ones,
// and leaves unchanged teams alone so an existing lead role is preserved.
export async function PUT(
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
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }
  // The target must be a member of the caller's org.
  const target = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, me.orgId)))
      .limit(1)
  )[0];
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.teamIds) ? body.teamIds : [];
  const requested = [
    ...new Set(raw.filter((v): v is number => Number.isInteger(v))),
  ];

  // Only ACTIVE teams in the caller's org are assignable; silently ignore any
  // id that isn't (never trust ids from the client).
  const validTeams = requested.length
    ? await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.orgId, me.orgId),
            isNull(teams.archivedAt),
            inArray(teams.id, requested),
          ),
        )
    : [];
  const desired = validTeams.map((t) => t.id);

  // Current memberships, scoped to this org's active teams (so archived-team
  // rows aren't stripped by a reconcile against the active set).
  const currentRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.orgId, me.orgId),
        isNull(teams.archivedAt),
      ),
    );
  const current = currentRows.map((r) => r.teamId);

  const { add, remove } = diffTeamMembership(current, desired);

  if (add.length > 0) {
    await db
      .insert(teamMembers)
      .values(add.map((teamId) => ({ teamId, userId, role: "member" })))
      .onConflictDoNothing();
  }
  if (remove.length > 0) {
    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, userId),
          inArray(teamMembers.teamId, remove),
        ),
      );
  }

  return NextResponse.json({ ok: true, teamIds: desired });
}
