import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { organisations, settings, users } from "@/db/schema";
import { avatarColor } from "@/lib/avatar";
import { slugify, slugProblem } from "@/lib/org";

// POST /api/orgs  { name: string, slug?: string }
// Self-serve signup: a signed-in Google identity with NO user row yet creates
// an organisation and becomes its admin. Users who already belong to an org
// can't create another (one org per email in v1).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "You already belong to an organisation" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Organisation name must be 2–60 characters" },
      { status: 400 },
    );
  }
  const slug =
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug.trim().toLowerCase()
      : slugify(name);
  const problem = slugProblem(slug);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const taken = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.slug, slug))
    .limit(1);
  if (taken.length > 0) {
    return NextResponse.json(
      { error: "That workspace URL is taken — pick another" },
      { status: 409 },
    );
  }

  const [org] = await db
    .insert(organisations)
    .values({ name, slug })
    .returning({ id: organisations.id });

  // Org defaults + the founding admin.
  await db.insert(settings).values({ orgId: org.id });
  await db.insert(users).values({
    orgId: org.id,
    email,
    name: session?.user?.name || null,
    image: session?.user?.image || null,
    role: "admin",
    avatarColor: avatarColor(session?.user?.name || email),
  });

  return NextResponse.json({ ok: true, orgId: org.id, slug });
}
