import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { avatarColor } from "@/lib/avatar";
import { getSessionUser } from "@/lib/session";

async function adminCount(orgId: number): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.role, "admin")));
  return rows.length;
}

// PATCH /api/users/[id] — update a member of the caller's org (role, name)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Target must be in the caller's org.
  const target = (
    await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, me.orgId)))
      .limit(1)
  )[0];
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.role && ["admin", "contributor", "recipient"].includes(body.role)) {
    // Don't allow demoting the org's last remaining administrator.
    if (
      body.role !== "admin" &&
      target.role === "admin" &&
      (await adminCount(me.orgId)) <= 1
    ) {
      return NextResponse.json(
        { error: "There must be at least one administrator." },
        { status: 400 },
      );
    }
    updates.role = body.role;
  }
  if (body.name !== undefined) {
    updates.name = body.name;
    updates.avatarColor = avatarColor(body.name || "");
  }

  const updated = await db
    .update(users)
    .set(updates)
    .where(and(eq(users.id, userId), eq(users.orgId, me.orgId)))
    .returning();

  if (!updated.length) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: updated[0] });
}

// DELETE /api/users/[id] — remove a member of the caller's org
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Prevent self-deletion
  if (me.id === userId) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const target = (
    await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, me.orgId)))
      .limit(1)
  )[0];
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  // Don't allow removing the org's last remaining administrator.
  if (target.role === "admin" && (await adminCount(me.orgId)) <= 1) {
    return NextResponse.json(
      { error: "There must be at least one administrator." },
      { status: 400 },
    );
  }

  try {
    await db
      .delete(users)
      .where(and(eq(users.id, userId), eq(users.orgId, me.orgId)));
  } catch {
    // Users with report history are referenced by report_instances (no cascade).
    return NextResponse.json(
      {
        error:
          "This member has report history and can't be deleted. Set their role to Recipient instead.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
