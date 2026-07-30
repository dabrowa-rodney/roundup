import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { TeamScreen } from "@/components/team-screen";

// Admin-only. The roster exposes every member's email, role, teams and
// last-sign-in, plus the org's team structure — the nav already hides this
// from non-admins, but the page itself has to enforce it (a contributor could
// otherwise just type the URL). The client screen lives in components/ so this
// server component can gate it.
export default async function TeamPage() {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") redirect("/my-reports");

  return <TeamScreen />;
}
