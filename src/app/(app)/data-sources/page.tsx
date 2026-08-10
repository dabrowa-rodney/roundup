import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Screen } from "@/components/screen";
import { DataSourcesTable } from "@/components/data-sources-table";

export default async function DataSourcesPage() {
  // Admin-only: connected sheets are org configuration.
  const me = await getSessionUser();
  if (!me || me.role !== "admin") redirect("/my-reports");

  return (
    <Screen title="Data sources" subtitle="Context pulled into each Roundup">
      <p className="mb-5 max-w-[560px] text-[14.5px] text-muted">
        Connect a Google Sheet to any report. Its numbers are pulled in as context
        when the weekly Roundup is generated — so the summary can cite real
        figures, not just what people wrote. Individual questions can have their
        own sheet too; those are set on the question, in Reports, and are listed
        here alongside the report they belong to.
      </p>
      <DataSourcesTable />
    </Screen>
  );
}
