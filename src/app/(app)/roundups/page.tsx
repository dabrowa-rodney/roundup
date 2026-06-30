import Link from "next/link";
import { Screen } from "@/components/screen";
import { ROUNDUPS_LIST, THIS_WEEK_BANNER } from "@/lib/data";
import type { RoundupListItem } from "@/lib/types";

const COLS = "grid-cols-[1.2fr_1.4fr_1fr_1fr_90px]";

function slug(week: string): string {
  return week.toLowerCase().replace(/\s+/g, "-");
}

function StatusPill({ status }: { status: RoundupListItem["status"] }) {
  const styles: Record<RoundupListItem["status"], string> = {
    Sent: "bg-good text-white",
    Draft: "bg-warn text-white",
    Pending: "bg-line text-muted",
  };
  return (
    <span
      className={`rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function RoundupsPage() {
  return (
    <Screen title="Roundups" subtitle="Generated weekly summaries">
      <div className="mb-[22px] flex flex-wrap items-center gap-5 rounded-card bg-accent px-[26px] py-6 text-accent-ink">
        <div className="min-w-[220px] flex-1">
          <div className="text-[12.5px] font-bold tracking-[0.05em] opacity-80">
            {THIS_WEEK_BANNER.label}
          </div>
          <div className="mt-[5px] font-head text-[20px] font-bold">
            {THIS_WEEK_BANNER.headline}
          </div>
          <div className="mt-1 text-[13.5px] opacity-85">
            {THIS_WEEK_BANNER.sub}
          </div>
        </div>
        <Link
          href="/roundups/week-25"
          className="rounded-[11px] bg-accent-ink px-[22px] py-3 text-sm font-bold text-accent"
        >
          Generate preview
        </Link>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div
          className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-bold tracking-[0.04em] text-muted`}
        >
          <span>WEEK</span>
          <span>RANGE</span>
          <span>REPORTS IN</span>
          <span>STATUS</span>
          <span />
        </div>
        {ROUNDUPS_LIST.map((r) => (
          <div
            key={r.week}
            className={`grid ${COLS} items-center gap-3.5 border-t border-line px-[22px] py-[15px]`}
          >
            <span className="font-head text-[14.5px] font-bold">{r.week}</span>
            <span className="text-[13.5px] text-muted">{r.range}</span>
            <span className="text-[13.5px]">{r.reports}</span>
            <span>
              <StatusPill status={r.status} />
            </span>
            <Link
              href={`/roundups/${slug(r.week)}`}
              className="text-right text-[13.5px] font-bold text-accent"
            >
              View →
            </Link>
          </div>
        ))}
      </div>
    </Screen>
  );
}
