import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailLog, roundupRecipients, roundups, teamMembers, teams, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import type { SkimJson } from "@/lib/roundup";
import { emailConfigured, roundupEmail, sendEmail } from "@/lib/email";
import { ensureRootTeam } from "@/lib/teams";
import {
  periodForCadence,
  periodLabel,
  periodRange,
  periodStartISO,
  type PeriodType,
} from "@/lib/dates";

export const maxDuration = 60;

// POST /api/roundups/send  { week: "YYYY-MM-DD", teamId?: number }
// Admin-only. Publishes a team's draft Roundup: records the recipient list,
// emails them, and marks the roundup sent. Without teamId the org's ROOT
// team is targeted — identical to the pre-teams behaviour.
//
// Recipients:
//   root team  → org users with the "recipient" role, plus admins (as today)
//   sub-teams  → tree-derived default: the team's leads + the parent team's
//                leads (explicit per-roundup selection arrives with the UI)
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = body.week ? new Date(body.week) : NaN;
  if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  // Resolve the target team — always scoped to the caller's org.
  let team: { id: number; parentTeamId: number | null; cadence: string };
  if (body.teamId !== undefined) {
    const teamId = Number(body.teamId);
    if (!Number.isInteger(teamId)) {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 });
    }
    const row = (
      await db
        .select({
          id: teams.id,
          parentTeamId: teams.parentTeamId,
          cadence: teams.cadence,
        })
        .from(teams)
        .where(
          and(
            eq(teams.id, teamId),
            eq(teams.orgId, me.orgId),
            isNull(teams.archivedAt),
          ),
        )
        .limit(1)
    )[0];
    if (!row) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    team = row;
  } else {
    const rootId = await ensureRootTeam(me.orgId);
    const row = (
      await db
        .select({
          id: teams.id,
          parentTeamId: teams.parentTeamId,
          cadence: teams.cadence,
        })
        .from(teams)
        .where(eq(teams.id, rootId))
        .limit(1)
    )[0];
    team = row;
  }

  const period: PeriodType = periodForCadence(team.cadence);
  const periodStart = periodStartISO(period, parsed);

  const roundup = (
    await db
      .select()
      .from(roundups)
      .where(
        and(
          eq(roundups.teamId, team.id),
          eq(roundups.periodType, period),
          eq(roundups.periodStart, periodStart),
        ),
      )
      .limit(1)
  )[0];
  if (!roundup?.skimJson) {
    return NextResponse.json(
      { error: "Generate this Roundup first" },
      { status: 409 },
    );
  }
  if (roundup.status === "sent") {
    return NextResponse.json(
      { error: "This Roundup has already been sent" },
      { status: 409 },
    );
  }

  // Resolve recipients: an EXPLICIT per-roundup selection (set via
  // /api/roundups/[id]/recipients) wins; otherwise tree-derived defaults.
  let recipients: { id: number; email: string }[];
  const explicit = await db
    .select({ id: users.id, email: users.email })
    .from(roundupRecipients)
    .innerJoin(users, eq(roundupRecipients.userId, users.id))
    .where(eq(roundupRecipients.roundupId, roundup.id));

  if (explicit.length > 0) {
    recipients = explicit;
  } else if (team.parentTeamId === null) {
    // Root default: org-wide "recipient" role plus admins — as ever.
    recipients = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(eq(users.orgId, me.orgId), inArray(users.role, ["recipient", "admin"])),
      );
  } else {
    // Sub-team default: this team's leads + the parent team's leads (deduped).
    const leadRows = await db
      .select({ id: users.id, email: users.email })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(
        and(
          inArray(teamMembers.teamId, [team.id, team.parentTeamId]),
          eq(teamMembers.role, "lead"),
        ),
      );
    const seen = new Set<number>();
    recipients = leadRows.filter((r) =>
      seen.has(r.id) ? false : (seen.add(r.id), true),
    );
  }

  const now = new Date();

  // Record who this Roundup went to.
  if (recipients.length > 0) {
    await db
      .insert(roundupRecipients)
      .values(recipients.map((r) => ({ roundupId: roundup.id, userId: r.id })))
      .onConflictDoNothing();
  }

  // Email each recipient a headline + link (no-op without RESEND_API_KEY).
  let emailed = 0;
  if (emailConfigured() && recipients.length > 0) {
    const skim = roundup.skimJson as SkimJson;
    const msg = roundupEmail({
      weekLabel: `${periodLabel(period, periodStart)} · ${periodRange(period, periodStart)}`,
      headline: skim.headline || "This period's Roundup is ready.",
      weekIso: periodStart,
    });
    for (const r of recipients) {
      if (await sendEmail({ to: r.email, ...msg })) emailed++;
    }
  }

  await db
    .update(roundups)
    .set({ status: "sent", sentAt: now })
    .where(eq(roundups.id, roundup.id));

  // Root keeps the legacy idempotency key; sub-team sends log per team via a
  // team-scoped kind (email_log is unique on org+kind+week).
  const logKind =
    team.parentTeamId === null ? "roundup_sent" : `roundup_sent:t${team.id}`;
  await db
    .insert(emailLog)
    .values({
      orgId: me.orgId,
      kind: logKind,
      weekStart: periodStart,
      recipientCount: emailed,
    })
    .onConflictDoNothing();

  return NextResponse.json({
    ok: true,
    recipients: recipients.length,
    emailed,
    emailConfigured: emailConfigured(),
  });
}
