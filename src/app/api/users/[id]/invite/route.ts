import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { organisations, users } from "@/db/schema";
import { emailConfigured, inviteEmail, sendEmail } from "@/lib/email";
import { getSessionUser } from "@/lib/session";

// POST /api/users/[id]/invite — resend the invitation email to a member of
// the caller's org who has never signed in.
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
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Email sending isn't configured" },
      { status: 503 },
    );
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Only pending members — someone who has signed in doesn't need an invite.
  const target = (
    await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.orgId, me.orgId),
          isNull(users.lastLoginAt),
        ),
      )
      .limit(1)
  )[0];
  if (!target) {
    return NextResponse.json(
      { error: "No pending invite for this member" },
      { status: 404 },
    );
  }

  const org = (
    await db
      .select({ name: organisations.name })
      .from(organisations)
      .where(eq(organisations.id, me.orgId))
      .limit(1)
  )[0];

  const emailed = await sendEmail({
    to: target.email,
    ...inviteEmail({
      inviterName: me.name || me.email,
      orgName: org?.name ?? "your team",
    }),
  });
  if (!emailed) {
    return NextResponse.json(
      { error: "Couldn't send the email — try again in a moment" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
