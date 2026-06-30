import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { avatarColor } from "@/lib/avatar";

// Comma-separated list of emails that should be administrators.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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

      if (existing.length === 0) {
        // Bootstrap: the very first user, or any configured admin email,
        // becomes an administrator. Everyone else is a contributor.
        const anyUser = await db.select({ id: users.id }).from(users).limit(1);
        const isAdmin = anyUser.length === 0 || ADMIN_EMAILS.includes(email);

        await db.insert(users).values({
          email,
          name: user.name || null,
          image: user.image || null,
          googleId: account?.providerAccountId || null,
          role: isAdmin ? "admin" : "contributor",
          avatarColor: avatarColor(user.name || email),
        });
      } else {
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
