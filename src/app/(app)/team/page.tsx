import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getTeamAuthority } from "@/lib/teams";
import { hasAnyTeamAuthority } from "@/lib/team-authority";
import { TeamScreen } from "@/components/team-screen";

// Org admins and team leads only. Admins get the full page; a lead gets the
// team tree so they can build and staff their own subtree (D3) — the People
// roster with its invite/role/remove actions stays admin-only, decided here
// and passed down, since the client can't be trusted to gate itself. The nav
// already hides this page from everyone else, but it has to enforce it too (a
// contributor could otherwise just type the URL). The client screen lives in
// components/ so this server component can gate it.
export default async function TeamPage() {
  const me = await getSessionUser();
  if (!me) redirect("/my-reports");

  const isAdmin = me.role === "admin";
  if (!isAdmin) {
    const auth = await getTeamAuthority(me.orgId, me.id, me.role);
    if (!hasAnyTeamAuthority(auth)) redirect("/my-reports");
  }

  return <TeamScreen isAdmin={isAdmin} />;
}
