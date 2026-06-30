import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Screen } from "@/components/screen";
import { ProgressBar, SectionLabel, StatusPill } from "@/components/ui";
import {
  ASSIGNED_REPORTS,
  CURRENT_USER,
  PAST_WEEKS,
  WEEK_LABEL,
} from "@/lib/data";
import type { ReportStatus } from "@/lib/types";

function progressFor(status: ReportStatus): number {
  return status === "Submitted" ? 100 : status === "In progress" ? 55 : 0;
}

export default async function MyReportsPage() {
  const session = await getServerSession(authOptions);
  const firstName = (session?.user?.name ?? CURRENT_USER.name).split(" ")[0];
  const count = ASSIGNED_REPORTS.length;

  return (
    <Screen title="My reports" subtitle="Your weekly updates">
      <div className="mb-6">
        <div className="font-head text-[26px] font-bold tracking-[-0.02em]">
          Good morning, {firstName} 👋
        </div>
        <p className="mt-1.5 text-[15px] text-muted">
          You have{" "}
          <strong className="text-ink">
            {count} report{count === 1 ? "" : "s"}
          </strong>{" "}
          to file for {WEEK_LABEL}.
        </p>
      </div>

      <div className="grid max-w-[840px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-[18px]">
        {ASSIGNED_REPORTS.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-head text-[18px] font-bold tracking-[-0.01em]">
                  {r.title}
                </div>
                <div className="mt-[3px] text-[13px] text-muted">
                  {r.area} · {r.qCount} questions
                </div>
              </div>
              <StatusPill status={r.status} />
            </div>
            <ProgressBar pct={progressFor(r.status)} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted">{r.edited}</span>
              <Link
                href={`/my-reports/${r.id}`}
                className="rounded-[10px] bg-accent px-[18px] py-[9px] text-[13.5px] font-bold text-accent-ink transition-opacity hover:opacity-90"
              >
                {r.cta} →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[34px] max-w-[840px]">
        <SectionLabel className="mb-3">Previous weeks</SectionLabel>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {PAST_WEEKS.map((w, i) => (
            <div
              key={w.week}
              className={`flex items-center gap-3.5 px-5 py-3.5 ${
                i > 0 ? "border-t border-line" : ""
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-good" aria-hidden />
              <span className="text-sm font-semibold">{w.week}</span>
              <span className="text-[13px] text-muted">{w.range}</span>
              <div className="flex-1" />
              <span className="text-[12.5px] text-muted">
                Submitted {w.when}
              </span>
              <Link
                href="/my-reports/customer-success/submitted"
                className="text-[13px] font-semibold text-accent"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
