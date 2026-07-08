import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organisations, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { avatarColor } from "@/lib/avatar";
import { emailConfigured, inviteEmail, sendEmail } from "@/lib/email";
import { getOrgPlan } from "@/lib/org-plan";
import { getSessionUser } from "@/lib/session";

// POST /api/users/invite — pre-create a member of the caller's org; when that
// email signs in with Google it lands in this organisation.
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Plan gate: member cap (every role counts as a seat).
  const plan = await getOrgPlan(me.orgId);
  const memberCount = (
    await db.select({ id: users.id }).from(users).where(eq(users.orgId, me.orgId))
  ).length;
  if (memberCount >= plan.limits.maxMembers) {
    return NextResponse.json(
      {
        error: `The ${plan.limits.label} plan includes up to ${plan.limits.maxMembers} members — upgrade in Settings to invite more.`,
      },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { email, name, role } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const validRoles = ["admin", "contributor", "recipient"];
  const userRole = validRoles.includes(role) ? role : "contributor";

  // Emails are globally unique — one organisation per email address (v1).
  const existing = await db
    .select({ id: users.id, orgId: users.orgId })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      {
        error:
          existing[0].orgId === me.orgId
            ? "User already exists"
            : "That email is already registered to another Roundup organisation",
      },
      { status: 409 },
    );
  }

  const displayName = name?.trim() || normalizedEmail.split("@")[0];

  const inserted = await db
    .insert(users)
    .values({
      orgId: me.orgId,
      email: normalizedEmail,
      name: displayName,
      role: userRole,
      avatarColor: avatarColor(displayName),
    })
    .returning();

  // Tell them (best effort — the invite stands even if the email fails).
  let emailed = false;
  if (emailConfigured()) {
    const org = (
      await db
        .select({ name: organisations.name })
        .from(organisations)
        .where(eq(organisations.id, me.orgId))
        .limit(1)
    )[0];
    emailed = await sendEmail({
      to: normalizedEmail,
      ...inviteEmail({
        inviterName: me.name || me.email,
        orgName: org?.name ?? "your team",
      }),
    });
  }

  return NextResponse.json({ user: inserted[0], emailed }, { status: 201 });
}
