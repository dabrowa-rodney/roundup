"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { relativeTime } from "@/lib/dates";
import { slugProblem } from "@/lib/org";
import { ConfirmDialog } from "./confirm-dialog";

interface OrgProp {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  hasAnthropicKey: boolean;
  plan: string;
  planStatus: string | null;
  trialEndsAt: string | null;
}
interface SettingsProp {
  closeDay: string;
  closeTime: string;
  openDay: string;
  openTime: string;
  reminder1Enabled: boolean;
  reminder1Day: string;
  reminder1Time: string;
  reminder2Enabled: boolean;
  reminder2Day: string;
  reminder2Time: string;
  reminderRoundupReady: boolean;
}
interface MemberProp {
  id: number;
  email: string;
  name: string | null;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}
interface TemplateProp {
  id: number;
  name: string;
  area: string | null;
  dataSourceUrl: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
}
interface WeekProp {
  weekStart: string;
  submitted: number;
  total: number;
}
interface RoundupProp {
  weekStart: string;
  status: string;
  generatedAt: string | null;
  sentAt: string | null;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMES = (() => {
  const t: string[] = [];
  for (let h = 0; h < 24; h++) {
    t.push(String(h).padStart(2, "0") + ":00");
    t.push(String(h).padStart(2, "0") + ":30");
  }
  return t;
})();

const inputClass =
  "w-full rounded-[9px] border border-line bg-bg px-3 py-[9px] text-[14px] text-ink";
const selectClass =
  "rounded-[9px] border border-line bg-bg px-2.5 py-2 text-[13.5px] font-semibold text-ink";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 rounded-card border border-line bg-surface px-[26px] py-6">
      <div className="mb-4 font-head text-[16px] font-bold">{title}</div>
      {children}
    </div>
  );
}

export function ConsoleOrgDetail({
  org,
  settings,
  members,
  templates,
  weeks,
  roundups,
}: {
  org: OrgProp;
  settings: SettingsProp | null;
  members: MemberProp[];
  templates: TemplateProp[];
  weeks: WeekProp[];
  roundups: RoundupProp[];
}) {
  const router = useRouter();
  const [renderedAt] = useState(() => Date.now());
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [sched, setSched] = useState<SettingsProp>(
    settings ?? {
      closeDay: "Sunday",
      closeTime: "20:00",
      openDay: "Monday",
      openTime: "01:00",
      reminder1Enabled: true,
      reminder1Day: "Thursday",
      reminder1Time: "13:00",
      reminder2Enabled: true,
      reminder2Day: "Friday",
      reminder2Time: "09:00",
      reminderRoundupReady: false,
    },
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState(false);

  const patch = async (body: Record<string, unknown>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/console/orgs/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ ok: true, text: okText });
        router.refresh();
      } else {
        setMsg({ ok: false, text: d.error || "Update failed" });
      }
    } catch {
      setMsg({ ok: false, text: "Update failed" });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  const roleLabel = (r: string) =>
    r === "admin" ? "Administrator" : r === "recipient" ? "Recipient" : "Contributor";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline gap-3">
        <h1 className="font-head text-[26px] font-bold tracking-[-0.02em]">
          {org.name}
        </h1>
        <span className="font-mono text-[13px] text-muted">
          {org.slug}.roundup.work
        </span>
        <span className="text-[13px] text-muted">
          · signed up{" "}
          {new Date(org.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.03em] ${
            org.plan === "complimentary"
              ? "bg-good-soft text-good-ink"
              : org.plan === "team" || org.plan === "business"
                ? "bg-accent-soft text-accent"
                : "bg-line/50 text-muted"
          }`}
        >
          {org.plan}
          {org.planStatus ? ` · ${org.planStatus}` : ""}
          {org.plan === "free" &&
          org.trialEndsAt &&
          new Date(org.trialEndsAt).getTime() > renderedAt
            ? " · trialing"
            : ""}
        </span>
        {msg && (
          <span
            className={`ml-auto text-[13px] font-semibold ${msg.ok ? "text-good" : "text-bad"}`}
          >
            {msg.text}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          {/* Organisation settings */}
          <Card title="Organisation">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Name
            </label>
            <div className="mb-4 flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              <button
                onClick={() => patch({ name: name.trim() }, "Name saved")}
                disabled={busy || name.trim().length < 2 || name === org.name}
                className="whitespace-nowrap rounded-full bg-accent px-4 py-[9px] text-[13px] font-bold text-accent-ink disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Workspace URL
            </label>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-[9px] border border-line bg-bg">
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className="min-w-0 flex-1 bg-transparent px-3 py-[9px] font-mono text-[13px] text-ink outline-none"
                />
                <span className="whitespace-nowrap px-2.5 font-mono text-[12px] text-muted">
                  .roundup.work
                </span>
              </div>
              <button
                onClick={() => patch({ slug: slug.trim() }, "Workspace URL saved")}
                disabled={busy || slug === org.slug || !!slugProblem(slug.trim())}
                className="whitespace-nowrap rounded-full bg-accent px-4 py-[9px] text-[13px] font-bold text-accent-ink disabled:opacity-40"
              >
                Save
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <span
                className={`text-[13px] font-semibold ${org.hasAnthropicKey ? "text-good" : "text-muted"}`}
              >
                {org.hasAnthropicKey
                  ? "✓ Anthropic key connected (AI Roundups on)"
                  : "No Anthropic key — deterministic Roundups"}
              </span>
              {org.hasAnthropicKey && (
                <button
                  onClick={() => setConfirmRemoveKey(true)}
                  disabled={busy}
                  className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-bad disabled:opacity-40"
                >
                  Remove key
                </button>
              )}
            </div>

            {(org.plan === "free" || org.plan === "complimentary") && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <span className="text-[13px] text-muted">
                  {org.plan === "complimentary"
                    ? "This organisation has complimentary (full) access."
                    : "Grant full access without a subscription:"}
                </span>
                <button
                  onClick={() =>
                    patch(
                      {
                        plan:
                          org.plan === "complimentary" ? "free" : "complimentary",
                      },
                      org.plan === "complimentary"
                        ? "Reverted to Free"
                        : "Complimentary access granted",
                    )
                  }
                  disabled={busy}
                  className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-semibold text-ink hover:border-accent disabled:opacity-40"
                >
                  {org.plan === "complimentary"
                    ? "Revoke complimentary"
                    : "Grant complimentary"}
                </button>
              </div>
            )}
          </Card>

          {/* Schedule + reminders */}
          <Card title="Weekly schedule & reminders">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["Closes", "closeDay", "closeTime"],
                  ["Reopens", "openDay", "openTime"],
                ] as const
              ).map(([label, dayKey, timeKey]) => (
                <div key={label} className="rounded-xl border border-line p-3">
                  <div className="mb-2 text-[12px] text-muted">{label}</div>
                  <div className="flex gap-1.5">
                    <select
                      value={sched[dayKey]}
                      onChange={(e) => setSched({ ...sched, [dayKey]: e.target.value })}
                      className={`min-w-0 flex-1 ${selectClass}`}
                    >
                      {DAYS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={sched[timeKey]}
                      onChange={(e) => setSched({ ...sched, [timeKey]: e.target.value })}
                      className={selectClass}
                    >
                      {TIMES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            {(
              [
                ["First reminder", "reminder1Enabled", "reminder1Day", "reminder1Time"],
                ["Second reminder", "reminder2Enabled", "reminder2Day", "reminder2Time"],
              ] as const
            ).map(([label, enabledKey, dayKey, timeKey]) => (
              <div key={label} className="mt-3 flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-2 text-[13px] font-semibold">
                  <input
                    type="checkbox"
                    checked={sched[enabledKey]}
                    onChange={(e) => setSched({ ...sched, [enabledKey]: e.target.checked })}
                  />
                  {label}
                </label>
                <select
                  value={sched[dayKey]}
                  onChange={(e) => setSched({ ...sched, [dayKey]: e.target.value })}
                  disabled={!sched[enabledKey]}
                  className={`${selectClass} disabled:opacity-40`}
                >
                  {DAYS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={sched[timeKey]}
                  onChange={(e) => setSched({ ...sched, [timeKey]: e.target.value })}
                  disabled={!sched[enabledKey]}
                  className={`${selectClass} disabled:opacity-40`}
                >
                  {TIMES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            ))}
            <label className="mt-3 flex items-center gap-2 text-[13px] font-semibold">
              <input
                type="checkbox"
                checked={sched.reminderRoundupReady}
                onChange={(e) =>
                  setSched({ ...sched, reminderRoundupReady: e.target.checked })
                }
              />
              Notify recipients when the Roundup is generated
            </label>
            <button
              onClick={() => patch({ settings: sched }, "Schedule saved")}
              disabled={busy}
              className="mt-4 rounded-full bg-accent px-4 py-[9px] text-[13px] font-bold text-accent-ink disabled:opacity-40"
            >
              Save schedule
            </button>
          </Card>
        </div>

        <div>
          {/* Team */}
          <Card title={`Team (${members.length})`}>
            <div className="flex flex-col">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">
                      {m.name || m.email}
                    </div>
                    <div className="truncate text-[12px] text-muted">{m.email}</div>
                  </div>
                  <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {roleLabel(m.role)}
                  </span>
                  <span className="w-[110px] text-right text-[12px] text-muted">
                    {m.lastLoginAt ? relativeTime(m.lastLoginAt) : (
                      <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn-ink">
                        invite pending
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Templates */}
          <Card title={`Report templates (${templates.filter((t) => !t.archivedAt).length} active)`}>
            <div className="flex flex-col">
              {templates.length === 0 && (
                <div className="text-[13px] text-muted">No templates yet.</div>
              )}
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-[13.5px] font-semibold ${t.deletedAt ? "text-muted line-through" : t.archivedAt ? "text-muted" : ""}`}
                    >
                      {t.name}
                    </div>
                    {t.area && (
                      <div className="truncate text-[12px] text-muted">{t.area}</div>
                    )}
                  </div>
                  {t.dataSourceUrl && !t.archivedAt && (
                    <span className="text-[11.5px] font-semibold text-good">● sheet</span>
                  )}
                  {t.deletedAt ? (
                    <span className="rounded-md bg-red-tint px-1.5 py-0.5 text-[11px] font-semibold text-bad">
                      deleted
                    </span>
                  ) : t.archivedAt ? (
                    <span className="rounded-md bg-line/50 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                      archived
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          {/* Activity */}
          <Card title="Recent activity">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
                  REPORTS BY WEEK
                </div>
                {weeks.length === 0 && (
                  <div className="text-[13px] text-muted">No submissions yet.</div>
                )}
                {weeks.map((w) => (
                  <div
                    key={w.weekStart}
                    className="flex items-center justify-between border-t border-line py-2 text-[13px] first:border-t-0"
                  >
                    <span className="font-mono text-[12px] text-muted">
                      w/c {w.weekStart}
                    </span>
                    <span className="font-semibold">
                      {w.submitted}/{w.total} in
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
                  ROUNDUPS
                </div>
                {roundups.length === 0 && (
                  <div className="text-[13px] text-muted">None generated yet.</div>
                )}
                {roundups.map((r) => (
                  <div
                    key={r.weekStart}
                    className="flex items-center justify-between border-t border-line py-2 text-[13px] first:border-t-0"
                  >
                    <span className="font-mono text-[12px] text-muted">
                      w/c {r.weekStart}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        r.status === "sent"
                          ? "bg-good-soft text-good-ink"
                          : "bg-warn-soft text-warn-ink"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemoveKey}
        title="Remove this organisation's Anthropic key?"
        body={
          <>
            AI Roundups keep working on paid plans via Roundup&apos;s own
            Anthropic account; this org just stops being billed directly for
            usage. On the Free plan they fall back to the rule-based compiler.
          </>
        }
        confirmLabel="Remove key"
        onConfirm={() => patch({ clearAnthropicKey: true }, "AI key removed")}
        onClose={() => setConfirmRemoveKey(false)}
      />
    </div>
  );
}
