import { Screen } from "@/components/screen";
import { Avatar, RoleBadge } from "@/components/ui";
import { TEAM, TEAM_STATS } from "@/lib/data";

const COLS = "grid-cols-[2fr_1.1fr_1.4fr_1.1fr_80px]";

function WeekStatus({ submitted }: { submitted: boolean | null }) {
  if (submitted === null) return <span className="text-[12px] text-muted">—</span>;
  return submitted ? (
    <span className="rounded-[7px] bg-good px-2.5 py-1 text-[11.5px] font-bold text-white">
      Submitted
    </span>
  ) : (
    <span className="rounded-[7px] bg-red-tint px-2.5 py-1 text-[11.5px] font-bold text-bad">
      Pending
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-5 py-4">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1 font-head text-[22px] font-bold">{value}</div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Screen title="Team" subtitle="People and permissions">
      <div className="mb-[18px] flex items-center">
        <div className="flex-1" />
        <button className="rounded-[11px] bg-accent px-[18px] py-2.5 text-sm font-bold text-accent-ink">
          + Invite member
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div
          className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-bold tracking-[0.04em] text-muted`}
        >
          <span>MEMBER</span>
          <span>ROLE</span>
          <span>ASSIGNED REPORT</span>
          <span>THIS WEEK</span>
          <span />
        </div>
        {TEAM.map((u) => (
          <div
            key={u.email}
            className={`grid ${COLS} items-center gap-3.5 border-t border-line px-[22px] py-3.5`}
          >
            <div className="flex min-w-0 items-center gap-[11px]">
              <Avatar name={u.name} size={34} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{u.name}</div>
                <div className="truncate text-[12px] text-muted">{u.email}</div>
              </div>
            </div>
            <span>
              <RoleBadge role={u.role} />
            </span>
            <span className="text-[13.5px] text-ink">{u.area}</span>
            <span>
              <WeekStatus submitted={u.submitted} />
            </span>
            <button
              aria-label={`Actions for ${u.name}`}
              className="text-right text-[18px] text-muted"
            >
              ···
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3.5">
        <StatCard label="Contributors" value={TEAM_STATS.contributors} />
        <StatCard label="Administrators" value={TEAM_STATS.administrators} />
        <StatCard label="Recipients only" value={TEAM_STATS.recipientsOnly} />
      </div>
    </Screen>
  );
}
