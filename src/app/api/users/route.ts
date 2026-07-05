import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, reportAssignees, reportTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";

// GET /api/users — the caller's org's members with their assigned report areas
export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
      avatarColor: users.avatarColor,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.orgId, me.orgId))
    .orderBy(users.name);

  // Assigned report template names per user (templates carry the org scope).
  const assignments = await db
    .select({
      userId: reportAssignees.userId,
      templateName: reportTemplates.name,
    })
    .from(reportAssignees)
    .innerJoin(reportTemplates, eq(reportAssignees.templateId, reportTemplates.id))
    .where(eq(reportTemplates.orgId, me.orgId));

  const assignmentMap = new Map<number, string[]>();
  for (const a of assignments) {
    const list = assignmentMap.get(a.userId) || [];
    list.push(a.templateName);
    assignmentMap.set(a.userId, list);
  }

  const result = allUsers.map((u) => ({
    ...u,
    areas: assignmentMap.get(u.id) || [],
  }));

  // Compute stats
  const stats = {
    contributors: allUsers.filter((u) => u.role === "contributor").length,
    administrators: allUsers.filter((u) => u.role === "admin").length,
    recipientsOnly: allUsers.filter((u) => u.role === "recipient").length,
  };

  return NextResponse.json({ users: result, stats });
}
