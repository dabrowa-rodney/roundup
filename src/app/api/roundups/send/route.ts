import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq, inArray } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { emailLog, roundupRecipients, roundups, users } from "@/db/schema";
import type { SkimJson } from "@/lib/roundup";
import { emailConfigured, roundupEmail, sendEmail } from "@/lib/email";
import { mondayISO, parseISODate, weekNumberLabel, weekRange } from "@/lib/dates";

export const maxDuration = 60;

// POST /api/roundups/send  { week: "YYYY-MM-DD" }
// Admin-only. Publishes a draft Roundup: records the recipient list, emails
// everyone with the "recipient" role, and marks the roundup as sent.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const caller = (
    await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, session.user.email.toLowerCase()))
      .limit(1)
  )[0];
  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = body.week ? new Date(body.week) : NaN;
  if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }
  const weekStart = mondayISO(parsed);

  const roundup = (
    await db.select().from(roundups).where(eq(roundups.weekStart, weekStart)).limit(1)
  )[0];
  if (!roundup?.skimJson) {
    return NextResponse.json(
      { error: "Generate this week's Roundup first" },
      { status: 409 },
    );
  }
  if (roundup.status === "sent") {
    return NextResponse.json(
      { error: "This Roundup has already been sent" },
      { status: 409 },
    );
  }

  // Recipients are managed on the Team page via the "recipient" role;
  // admins always receive the Roundup as well.
  const recipients = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.role, ["recipient", "admin"]));

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
    const monday = parseISODate(weekStart);
    const msg = roundupEmail({
      weekLabel: `${weekNumberLabel(monday)} · ${weekRange(monday)}`,
      headline: skim.headline || "This week's Roundup is ready.",
      weekIso: weekStart,
    });
    for (const r of recipients) {
      if (await sendEmail({ to: r.email, ...msg })) emailed++;
    }
  }

  await db
    .update(roundups)
    .set({ status: "sent", sentAt: now })
    .where(eq(roundups.id, roundup.id));

  await db
    .insert(emailLog)
    .values({ kind: "roundup_sent", weekStart, recipientCount: emailed })
    .onConflictDoNothing();

  return NextResponse.json({
    ok: true,
    recipients: recipients.length,
    emailed,
    emailConfigured: emailConfigured(),
  });
}
