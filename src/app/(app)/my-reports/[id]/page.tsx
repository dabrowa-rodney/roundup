import { Screen } from "@/components/screen";
import { ReportForm } from "@/components/report-form";
import { ASSIGNED_REPORTS, WEEK_LABEL } from "@/lib/data";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report =
    ASSIGNED_REPORTS.find((r) => r.id === id) ?? ASSIGNED_REPORTS[0];

  return (
    <Screen title={report.title} subtitle={`Weekly update · ${WEEK_LABEL}`}>
      <ReportForm reportId={id} />
    </Screen>
  );
}
