// Session → org-scoped caller resolution. Every API route and server page
// goes through these instead of re-implementing the users lookup, so org
// scoping can't be forgotten: the caller's orgId comes from the DB row tied
// to their signed-in email — never from client input.

import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export interface SessionUser {
  id: number;
  orgId: number;
  email: string;
  name: string | null;
  role: string;
}

/** The signed-in user's DB row, or null (not signed in / not onboarded). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const row = (
    await db
      .select({
        id: users.id,
        orgId: users.orgId,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
  )[0];
  return row ?? null;
}

/** Signed-in Google identity that has no user row yet (needs onboarding). */
export async function getPendingEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return existing.length === 0 ? email : null;
}
