import { Screen } from "@/components/screen";
import { RoundupViewer } from "@/components/roundup-viewer";

export default async function RoundupViewerPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  // The slug is accepted for routing; this UI-first build renders the Week 25 demo.
  await params;

  return (
    <Screen title="Roundup" subtitle="Week 25 · 15–21 Jun 2026">
      <RoundupViewer />
    </Screen>
  );
}
