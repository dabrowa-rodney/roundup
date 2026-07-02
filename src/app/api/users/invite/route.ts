import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { avatarColor } from "@/lib/avatar";

// POST /api/users/invite — invite a new user (pre-create them)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check caller is admin
  const caller = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, session.user.email.toLowerCase()))
    .limit(1);

  if (!caller.length || caller[0].role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, name, role } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const validRoles = ["admin", "contributor", "recipient"];
  const userRole = validRoles.includes(role) ? role : "contributor";

  // Check if user already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const displayName = name?.trim() || normalizedEmail.split("@")[0];

  const inserted = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name: displayName,
      role: userRole,
      avatarColor: avatarColor(displayName),
    })
    .returning();

  return NextResponse.json({ user: inserted[0] }, { status: 201 });
}
