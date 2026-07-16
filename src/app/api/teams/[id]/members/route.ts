import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { teamMembers, teams, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

async function orgTeam(teamId: number, orgId: number) {
  return (
    await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)))
      .limit(1)
  )[0];
}

// POST /api/teams/[id]/members  { userId, role? } — add a member (or change
// their role). role: 'lead' | 'member'. Admin-only. A person can belong to
// many teams; this only touches THIS team's row.
export async function POST(
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
  if (!(await orgTeam(teamId, me.orgId))) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
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
// Admin-only. Their reports and other team memberships are untouched.
export async function DELETE(
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
  const userId = parseInt(req.nextUrl.searchParams.get("userId") ?? "", 10);
  if (isNaN(teamId) || isNaN(userId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!(await orgTeam(teamId, me.orgId))) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  return NextResponse.json({ ok: true });
}
