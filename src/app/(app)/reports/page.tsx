import { Screen } from "@/components/screen";
import { ReportsManager } from "@/components/reports-manager";

export default function ReportsPage() {
  return (
    <Screen title="Reports" subtitle="Templates your team completes">
      <ReportsManager />
    </Screen>
  );
}
