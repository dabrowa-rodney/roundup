import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Screen } from "@/components/screen";
import { ReportsManager } from "@/components/reports-manager";

export default async function ReportsPage() {
  // Admin-only: templates and their assignees are org configuration.
  const me = await getSessionUser();
  if (!me || me.role !== "admin") redirect("/my-reports");

  return (
    <Screen title="Reports" subtitle="Templates your team completes">
      <ReportsManager />
    </Screen>
  );
}
