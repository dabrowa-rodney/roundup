import { Screen } from "@/components/screen";
import { DataSourcesTable } from "@/components/data-sources-table";

export default function DataSourcesPage() {
  return (
    <Screen title="Data sources" subtitle="Context pulled into each Roundup">
      <p className="mb-5 max-w-[560px] text-[14.5px] text-muted">
        Connect a Google Sheet to any report. Its numbers are pulled in as context
        when the weekly Roundup is generated — so the summary can cite real
        figures, not just what people wrote.
      </p>
      <DataSourcesTable />
    </Screen>
  );
}
