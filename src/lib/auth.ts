import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { consumeLoginToken } from "@/lib/magic-link";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Magic-link sign-in: the emailed link carries a single-use token which
    // /auth/verify exchanges here. Same email ⇒ same account as Google.
    CredentialsProvider({
      id: "magic",
      name: "Email link",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const claimed = await consumeLoginToken(
          credentials?.email ?? "",
          credentials?.token ?? "",
        );
        if (!claimed) return null;
        // Prefer the DB name (existing/invited member) over the sign-up form's.
        const existing = (
          await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.email, claimed.email))
            .limit(1)
        )[0];
        return {
          id: claimed.email,
          email: claimed.email,
          name: existing?.name ?? claimed.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length > 0) {
        // Known member (created via invite or org signup) — refresh profile.
        // googleId only ever comes from the Google provider.
        await db
          .update(users)
          .set({
            name: user.name || existing[0].name,
            image: user.image || existing[0].image,
            googleId:
              account?.provider === "google"
                ? account.providerAccountId
                : existing[0].googleId,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.email, email));
      }
      // Unknown email: allow the sign-in but create NO user row — the app
      // layout routes them to /onboarding, where they either create an
      // organisation (becoming its admin) or learn to ask for an invite.
      return true;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.email, session.user.email.toLowerCase()))
          .limit(1);

        if (dbUser.length > 0) {
          (session.user as Record<string, unknown>).id = dbUser[0].id;
          (session.user as Record<string, unknown>).role = dbUser[0].role;
          (session.user as Record<string, unknown>).orgId = dbUser[0].orgId;
          // DB name wins (e.g. set by an inviting admin or at onboarding).
          if (dbUser[0].name) session.user.name = dbUser[0].name;
        } else if (!session.user.name && typeof token.name === "string") {
          session.user.name = token.name;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
