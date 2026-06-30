import { Screen } from "@/components/screen";
import { SettingsScreen } from "@/components/settings-screen";

export default function SettingsPage() {
  return (
    <Screen title="Settings" subtitle="Account and platform">
      <SettingsScreen />
    </Screen>
  );
}
