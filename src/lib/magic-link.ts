// Magic-link sign-in: issue and consume single-use email tokens.
//
// The raw token travels only inside the emailed link; the DB stores its
// SHA-256 hash. Requesting a new link invalidates any previous one for that
// email (one active token per address), links expire after 15 minutes, and
// consumption is atomic (the UPDATE claims the token) so a link can't be
// replayed.

import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { loginTokens } from "@/db/schema";

export const TOKEN_TTL_MS = 15 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a sign-in token for an email; returns the RAW token for the link. */
export async function createLoginToken(
  email: string,
  name?: string | null,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  // One active token per address — a new request invalidates older links.
  await db.delete(loginTokens).where(eq(loginTokens.email, email));
  await db.insert(loginTokens).values({
    email,
    name: name?.trim() || null,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return token;
}

/**
 * Consume a token: valid + unexpired + unused → marks it used and returns
 * the email/name it was issued for; otherwise null. Atomic — the UPDATE's
 * WHERE clause claims the row, so two racing clicks can't both win.
 */
export async function consumeLoginToken(
  email: string,
  token: string,
): Promise<{ email: string; name: string | null } | null> {
  if (!email || !token) return null;
  const claimed = await db
    .update(loginTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(loginTokens.email, email.toLowerCase()),
        eq(loginTokens.tokenHash, hashToken(token)),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, new Date()),
      ),
    )
    .returning({ email: loginTokens.email, name: loginTokens.name });
  return claimed[0] ?? null;
}
