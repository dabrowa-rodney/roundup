import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Screen } from "@/components/screen";
import { SettingsScreen } from "@/components/settings-screen";

// Everyone gets Settings (it holds their own account), but the org, billing,
// schedule and reminder cards are admin-only — resolved here because the role
// isn't carried in the session token.
export default async function SettingsPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  return (
    <Screen title="Settings" subtitle="Account and platform">
      <SettingsScreen isAdmin={me.role === "admin"} />
    </Screen>
  );
}
