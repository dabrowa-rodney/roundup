import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
        await db
          .update(users)
          .set({
            name: user.name || existing[0].name,
            image: user.image || existing[0].image,
            googleId: account?.providerAccountId || existing[0].googleId,
            updatedAt: new Date(),
          })
          .where(eq(users.email, email));
      }
      // Unknown email: allow the Google sign-in but create NO user row —
      // the app layout routes them to /onboarding, where they either create
      // an organisation (becoming its admin) or learn to ask for an invite.
      return true;
    },
    async session({ session }) {
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
