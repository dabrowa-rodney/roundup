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
  "In progress": "bg-warn text-white",
  "Not started": "bg-line text-muted",
  Submitted: "bg-good text-white",
};

export function StatusPill({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`whitespace-nowrap rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold ${STATUS_PILL[status]}`}
    >
      {status}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    Administrator: "bg-accent-soft text-accent",
    Contributor: "bg-line text-ink",
    Recipient: "border border-line text-muted",
  };
  return (
    <span
      className={`rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold ${styles[role]}`}
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
      className={`text-[12px] font-bold uppercase tracking-[0.06em] text-muted ${className}`}
    >
      {children}
    </div>
  );
}
