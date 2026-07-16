import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { roundupRecipients, roundups, teamMembers, teams, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

// Per-roundup recipient selection (D6). A roundup's audience is whoever is
// selected on THAT roundup; before anyone is selected, the send flow falls
// back to tree-derived defaults. Selection locks once the roundup is sent —
// from then on roundup_recipients is the historical record of who got it.

async function loadRoundup(id: number, orgId: number) {
  return (
    await db
      .select({
        id: roundups.id,
        orgId: roundups.orgId,
        teamId: roundups.teamId,
        status: roundups.status,
      })
      .from(roundups)
      .where(and(eq(roundups.id, id), eq(roundups.orgId, orgId)))
      .limit(1)
  )[0];
}

/** Tree-derived default audience: root team → org recipient-role users +
 *  admins; sub-team → its leads + the parent team's leads. */
async function defaultRecipientIds(
  orgId: number,
  teamId: number,
): Promise<number[]> {
  const team = (
    await db
      .select({ id: teams.id, parentTeamId: teams.parentTeamId })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)))
      .limit(1)
  )[0];
  if (!team) return [];

  if (team.parentTeamId === null) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.orgId, orgId), inArray(users.role, ["recipient", "admin"])),
      );
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ id: teamMembers.userId })
    .from(teamMembers)
    .where(
      and(
        inArray(teamMembers.teamId, [team.id, team.parentTeamId]),
        eq(teamMembers.role, "lead"),
      ),
    );
  return [...new Set(rows.map((r) => r.id))];
}

// GET /api/roundups/[id]/recipients — the roundup's explicit selection (may be
// empty) plus the tree-derived defaults the send flow would otherwise use.
export async function GET(
  _req: NextRequest,
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
  const roundupId = parseInt(id, 10);
  if (isNaN(roundupId)) {
    return NextResponse.json({ error: "Invalid roundup" }, { status: 400 });
  }
  const roundup = await loadRoundup(roundupId, me.orgId);
  if (!roundup) {
    return NextResponse.json({ error: "Roundup not found" }, { status: 404 });
  }

  const selectedRows = await db
    .select({ userId: roundupRecipients.userId })
    .from(roundupRecipients)
    .where(eq(roundupRecipients.roundupId, roundup.id));

  return NextResponse.json({
    selected: selectedRows.map((r) => r.userId),
    defaults: await defaultRecipientIds(me.orgId, roundup.teamId),
    sent: roundup.status === "sent",
  });
}

// PUT /api/roundups/[id]/recipients  { userIds: number[] }
// Replace the explicit selection. Refused once sent (the list is then a
// historical record). Every id must be a member of the caller's org.
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
  const roundupId = parseInt(id, 10);
  if (isNaN(roundupId)) {
    return NextResponse.json({ error: "Invalid roundup" }, { status: 400 });
  }
  const roundup = await loadRoundup(roundupId, me.orgId);
  if (!roundup) {
    return NextResponse.json({ error: "Roundup not found" }, { status: 404 });
  }
  if (roundup.status === "sent") {
    return NextResponse.json(
      { error: "This Roundup has been sent — its recipient list is final" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.userIds) ? body.userIds : [];
  const userIds = [
    ...new Set(raw.filter((v): v is number => Number.isInteger(v))),
  ];

  // Only members of the caller's org may be selected.
  if (userIds.length > 0) {
    const valid = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, me.orgId), inArray(users.id, userIds)));
    if (valid.length !== userIds.length) {
      return NextResponse.json(
        { error: "Unknown recipient in selection" },
        { status: 400 },
      );
    }
  }

  // Replace the selection wholesale.
  await db
    .delete(roundupRecipients)
    .where(eq(roundupRecipients.roundupId, roundup.id));
  if (userIds.length > 0) {
    await db
      .insert(roundupRecipients)
      .values(userIds.map((userId) => ({ roundupId: roundup.id, userId })))
      .onConflictDoNothing();
  }

  return NextResponse.json({ ok: true, selected: userIds });
}
