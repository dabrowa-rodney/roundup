import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { avatarColor } from "@/lib/avatar";

// PATCH /api/users/[id] — update user role, name, etc.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check caller is admin
  const caller = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!caller.length || caller[0].role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.role && ["admin", "contributor", "recipient"].includes(body.role)) {
    updates.role = body.role;
  }
  if (body.name !== undefined) {
    updates.name = body.name;
    updates.avatarColor = avatarColor(body.name || "");
  }

  const updated = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();

  if (!updated.length) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: updated[0] });
}

// DELETE /api/users/[id] — remove a user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check caller is admin
  const caller = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!caller.length || caller[0].role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Prevent self-deletion
  if (caller[0].id === userId) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const deleted = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning();

  if (!deleted.length) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
