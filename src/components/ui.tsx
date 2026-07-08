import { avatarColor, initials } from "@/lib/avatar";
import type { ReportStatus, Role } from "@/lib/types";

/** Initials avatar with a deterministic, name-hashed background. */
export function Avatar({
  name,
  size = 32,
  ring = false,
}: {
  name: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        fontSize: size <= 24 ? 10 : size <= 28 ? 11 : size <= 34 ? 13 : 17,
        border: ring ? "2px solid var(--surface)" : undefined,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

const STATUS_PILL: Record<ReportStatus, string> = {
  "In progress": "bg-warn-soft text-warn-ink",
  "Not started": "bg-line/50 text-muted",
  Submitted: "bg-good-soft text-good-ink",
};

export function StatusPill({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${STATUS_PILL[status]}`}
    >
      {status}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    Administrator: "bg-accent-soft text-accent",
    Contributor: "bg-line/50 text-ink",
    Recipient: "border border-line text-muted",
  };
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${styles[role]}`}
    >
      {role}
    </span>
  );
}

/** Thin progress bar — track + accent fill. */
export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[12px] font-semibold uppercase tracking-[0.06em] text-muted ${className}`}
    >
      {children}
    </div>
  );
}
