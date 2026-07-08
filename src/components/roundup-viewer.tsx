"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, RefreshCw, Send } from "lucide-react";
import { Segmented } from "./segmented";
import type {
  ChartItem,
  FullJson,
  MetricItem,
  Rag,
  SkimJson,
} from "@/lib/roundup";

type Mode = "skim" | "full";

const MODE_OPTIONS = [
  { value: "skim" as const, label: "Skim" },
  { value: "full" as const, label: "Full report" },
];

const RAG_COLOR: Record<Rag, string> = {
  green: "#47AB7E",
  amber: "#F5B02B",
  red: "#E11D48",
};

function ragColor(rag: Rag | null): string {
  return rag ? RAG_COLOR[rag] : "var(--muted)";
}

function deltaParts(m: MetricItem): { text: string; good: boolean } | null {
  if (!m.delta) return null;
  // Compiler emits "\u2191 \u00a3123" / "\u2193 0.4" — present as "+\u00a3123 wk" / "\u22120.4 wk".
  const text = m.delta.replace(/^\u2191\s*/, "+").replace(/^\u2193\s*/, "\u2212") + " wk";
  return { text, good: m.good };
}

function MetricCard({ m, compact = false }: { m: MetricItem; compact?: boolean }) {
  const delta = deltaParts(m);
  return (
    <div
      className={`rounded-card border border-line bg-surface ${
        compact ? "px-4 py-3.5" : "px-[18px] py-4"
      }`}
    >
      <div className="text-[12px] font-medium text-muted">{m.label}</div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
        <span
          className={`font-head font-bold tracking-[-0.02em] ${
            compact ? "text-[20px]" : "text-[24px]"
          }`}
        >
          {m.value}
        </span>
        {delta && (
          <span
            className="text-[12px] font-semibold"
            style={{ color: delta.good ? "var(--good)" : "var(--bad)" }}
          >
            {delta.text}
          </span>
        )}
      </div>
    </div>
  );
}

function fmtVal(unit: string, n: number): string {
  return `${unit}${n.toLocaleString("en-GB", {
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  })}`;
}

/** Minimal SVG chart per the dashboard restyle: accent line + 7% area fill,
 *  endpoint dot, a single baseline hairline — no gridlines, no axis labels. */
function ChartCard({ c }: { c: ChartItem }) {
  const W = 560;
  const H = 170;
  const padT = 10;
  const padB = 10;
  const padX = 4;
  const innerW = W - padX * 2;
  const innerH = H - padT - padB;

  const ys = c.points.map((p) => p.y);
  const max = Math.max(...ys);
  const min = c.type === "bar" ? Math.min(0, ...ys) : Math.min(...ys);
  const span = max - min || 1;
  const n = c.points.length;
  const px = (i: number) =>
    padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const py = (v: number) => padT + innerH - ((v - min) / span) * innerH;
  const last = c.points[n - 1];

  const linePts = c.points.map((p, i) => `${px(i)},${py(p.y)}`).join(" ");
  const areaPath =
    `M ${px(0)} ${padT + innerH} ` +
    c.points.map((p, i) => `L ${px(i)} ${py(p.y)}`).join(" ") +
    ` L ${px(n - 1)} ${padT + innerH} Z`;
  const barW = (innerW / n) * 0.62;

  return (
    <div className="rounded-card border border-line bg-surface px-[18px] pb-3.5 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[13px] font-semibold">
          {c.title}
          {c.unit ? ` (${c.unit})` : ""}
        </div>
        <div className="whitespace-nowrap text-[11.5px] text-muted">
          last {c.points.length} periods
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2.5 block w-full"
        role="img"
        aria-label={`${c.title}: ${c.points.length} points, latest ${fmtVal(c.unit, last.y)}`}
      >
        {/* single baseline hairline */}
        <line x1={padX} y1={padT + innerH} x2={W - padX} y2={padT + innerH} stroke="var(--line)" />
        {c.type === "line" ? (
          <>
            <path d={areaPath} fill="var(--accent)" opacity="0.07" />
            <polyline
              points={linePts}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={px(n - 1)} cy={py(last.y)} r="4" fill="var(--accent)" />
          </>
        ) : (
          c.points.map((p, i) => (
            <rect
              key={i}
              x={px(i) - barW / 2}
              y={py(p.y)}
              width={barW}
              height={Math.max(1.5, padT + innerH - py(p.y))}
              rx="3"
              fill="var(--accent)"
              opacity={i === n - 1 ? 1 : 0.45}
            />
          ))
        )}
      </svg>
      {c.note && (
        <div className="mt-1 text-[12px] leading-[1.5] text-muted">{c.note}</div>
      )}
    </div>
  );
}

function RegenerateButton({ week }: { week: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const regenerate = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/roundups/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week }),
      });
      if (res.ok) {
        router.refresh(); // pull the fresh skim/full into the server page
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={regenerate}
      disabled={loading}
      title="Rebuild this Roundup from the latest submitted reports"
      className={`flex items-center gap-[7px] rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-60 ${
        error ? "text-bad" : "text-ink"
      }`}
    >
      <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
      {loading ? "Regenerating…" : error ? "Failed — retry" : "Regenerate"}
    </button>
  );
}

function SendButton({ week, initialSent }: { week: string; initialSent: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">(
    initialSent ? "sent" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const send = async () => {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/roundups/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("sent");
        // Published, but be honest when the emails themselves didn't go out.
        if (data.emailConfigured === false) {
          setWarning("Published, but no emails sent — RESEND_API_KEY isn't set.");
        } else if (data.recipients === 0) {
          setWarning("Published, but there are no recipients yet.");
        } else if (data.emailed < data.recipients) {
          setWarning(
            `Emailed ${data.emailed} of ${data.recipients} recipients — the rest failed (check the sender domain in Resend).`,
          );
        }
      } else {
        setState("idle");
        setError(data.error || "Couldn't send — try again.");
      }
    } catch {
      setState("idle");
      setError("Couldn't send — try again.");
    }
  };

  if (state === "sent") {
    return (
      <div className="flex items-center gap-2.5">
        {warning && (
          <span className="max-w-[340px] text-right text-[12.5px] font-medium text-warn-ink">
            {warning}
          </span>
        )}
        <span className="flex items-center gap-[7px] whitespace-nowrap rounded-full bg-good-soft px-4 py-2.5 text-[13.5px] font-semibold text-good-ink">
          <Check size={15} /> {warning ? "Published" : "Sent to recipients"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      {error && (
        <span className="text-[12.5px] font-medium text-bad">{error}</span>
      )}
      <button
        onClick={send}
        disabled={state === "sending"}
        className="flex items-center gap-[7px] rounded-full bg-accent px-4 py-2.5 text-[13.5px] font-bold text-accent-ink disabled:opacity-60"
      >
        <Send size={15} />
        {state === "sending" ? "Sending…" : "Send to recipients"}
      </button>
    </div>
  );
}

export function RoundupViewer({
  skim,
  full,
  week,
  sent = false,
  canManage = false,
}: {
  skim: SkimJson;
  full: FullJson;
  week?: string;
  sent?: boolean;
  /** Admins can regenerate and send; recipients just read. */
  canManage?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("skim");

  return (
    <div className="mx-auto max-w-[980px]">
      <Link
        href="/roundups"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted hover:text-accent"
      >
        <ArrowLeft size={13} /> All roundups
      </Link>

      {/* Header row: eyebrow + AI headline left, actions right */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-[260px] max-w-[560px]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            Weekly roundup · {skim.week} · {skim.range}
          </div>
          <h1 className="mt-1.5 font-head text-[24px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
            {skim.headline}
          </h1>
          <div className="mt-2 text-[12px] text-muted">
            {skim.reportsIn}
            {skim.generated ? ` · ${skim.generated}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
          {canManage && week && !sent && <RegenerateButton week={week} />}
          {canManage && week && <SendButton week={week} initialSent={sent} />}
        </div>
      </div>

      {mode === "skim" ? <Skim skim={skim} /> : <Full full={full} />}
    </div>
  );
}

function Skim({ skim }: { skim: SkimJson }) {
  const charts = skim.charts ?? [];
  const [heroChart, ...extraCharts] = charts;
  const showChanges = skim.changes.length > 0;
  const showHighlights = skim.highlights.length > 0;

  return (
    <div className="fade-up">
      {/* Metric cards */}
      {skim.metrics.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          {skim.metrics.map((m, i) => (
            <MetricCard key={i} m={m} />
          ))}
        </div>
      )}

      {/* Chart + by-team row */}
      {(heroChart || skim.byTeam.length > 0) && (
        <div
          className={`mt-3.5 grid gap-3.5 ${
            heroChart && skim.byTeam.length > 0
              ? "grid-cols-1 lg:grid-cols-[3fr_2fr]"
              : "grid-cols-1"
          }`}
        >
          {heroChart && <ChartCard c={heroChart} />}
          {skim.byTeam.length > 0 && (
            <div className="rounded-card border border-line bg-surface px-[18px] pb-2.5 pt-4">
              <div className="mb-2 text-[13px] font-semibold">By team</div>
              {skim.byTeam.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 py-[7px]">
                  <span
                    className="h-[9px] w-[9px] flex-shrink-0 rounded-full"
                    style={{ background: ragColor(c.rag) }}
                  />
                  <span className="w-[92px] flex-shrink-0 truncate text-[12.5px] font-semibold text-ink">
                    {c.area || c.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                    {c.line}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {extraCharts.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-3.5">
          {extraCharts.map((c, i) => (
            <ChartCard key={i} c={c} />
          ))}
        </div>
      )}

      {/* Needs attention */}
      {skim.risks.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-2.5">
          {skim.risks.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-card border border-bad-line bg-bad-soft px-5 py-3.5"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--bad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 flex-shrink-0"
                aria-hidden
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <div className="text-[13px] leading-[1.55] text-bad-ink">
                <strong className="font-bold text-bad">Needs attention:</strong>{" "}
                {r.text}
                <span className="text-bad-ink/70"> — {r.who}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Highlights & changes */}
      {(showChanges || showHighlights) && (
        <div
          className={`mt-3.5 grid gap-3.5 ${
            showChanges && showHighlights
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {showChanges && (
            <div className="rounded-card border border-line bg-surface px-[18px] pb-2.5 pt-4">
              <div className="mb-2 text-[13px] font-semibold">What changed</div>
              {skim.changes.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 py-[7px]">
                  <span
                    className="mt-0.5 flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded-[6px] text-[12px] font-extrabold"
                    style={{
                      background:
                        c.dir === "up" ? "var(--good-soft)" : "var(--red-tint)",
                      color: c.dir === "up" ? "var(--good)" : "var(--bad)",
                    }}
                  >
                    {c.dir === "up" ? "↑" : "↓"}
                  </span>
                  <span className="text-[12.5px] leading-[1.5]">{c.text}</span>
                </div>
              ))}
            </div>
          )}
          {showHighlights && (
            <div className="rounded-card border border-line bg-surface px-[18px] pb-2.5 pt-4">
              <div className="mb-2 text-[13px] font-semibold text-good">
                ★ Highlights
              </div>
              {skim.highlights.map((w, i) => (
                <div key={i} className="py-[7px]">
                  <div className="text-[12.5px] font-medium leading-[1.5]">
                    {w.text}
                  </div>
                  <div className="mt-[2px] text-[11.5px] text-muted">{w.who}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Full({ full }: { full: FullJson }) {
  return (
    <div className="fade-up rounded-card border border-line bg-surface px-6 py-10 md:px-14 md:py-12">
      <div className="text-[12.5px] font-bold tracking-[0.06em] text-muted">
        WEEKLY ROUNDUP
      </div>
      <h1 className="mb-1.5 mt-2.5 font-head text-[32px] font-bold leading-[1.15] tracking-[-0.025em]">
        {full.title}
      </h1>
      <div className="border-b border-line pb-[22px] text-[13.5px] text-muted">
        {full.subtitle}
      </div>

      <section className="mt-[26px]">
        <div className="font-head text-[16px] font-bold tracking-[0.02em] text-accent">
          Executive summary
        </div>
        <p className="mt-2.5 text-[15.5px] leading-[1.75]">{full.execSummary}</p>
      </section>

      {full.risks.length > 0 && (
        <section className="mt-7">
          <div className="font-head text-[16px] font-bold text-bad">
            Risks needing attention
          </div>
          <ol className="ml-5 mt-2.5 list-decimal text-[15px] leading-[1.7]">
            {full.risks.map((r, i) => (
              <li key={i} className="mb-2 last:mb-0">
                <strong>{r.lead}.</strong> {r.text}
              </li>
            ))}
          </ol>
        </section>
      )}

      {full.changed.length > 0 && (
        <section className="mt-7">
          <div className="font-head text-[16px] font-bold">
            What changed since last week
          </div>
          <ul className="ml-5 mt-2.5 list-disc text-[15px] leading-[1.7]">
            {full.changed.map((c, i) => (
              <li key={i} className="mb-1.5 last:mb-0">
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {full.highlights.length > 0 && (
        <section className="mt-7">
          <div className="font-head text-[16px] font-bold text-good">
            Highlights
          </div>
          <ul className="ml-5 mt-2.5 list-disc text-[15px] leading-[1.7]">
            {full.highlights.map((h, i) => (
              <li key={i} className="mb-1.5 last:mb-0">
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {full.byTeam.length > 0 && (
        <section className="mt-7">
          <div className="font-head text-[16px] font-bold">By team</div>
          <div className="mt-3 flex flex-col">
            {full.byTeam.map((c, i) => (
              <div key={i} className="flex gap-3.5 border-t border-line py-3.5">
                <span
                  className="mt-1.5 h-[9px] w-[9px] flex-shrink-0 rounded-full"
                  style={{ background: ragColor(c.rag) }}
                />
                <div>
                  <div className="text-[14.5px] font-bold">
                    {c.name} ·{" "}
                    <span className="font-medium text-muted">{c.area}</span>
                  </div>
                  <div className="mt-[3px] text-[14.5px] leading-[1.6]">
                    {c.line}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(full.charts?.length ?? 0) > 0 && (
        <section className="mt-7">
          <div className="font-head text-[16px] font-bold">Trends</div>
          <div className="mt-3 flex flex-col gap-3">
            {full.charts!.map((c, i) => (
              <ChartCard key={i} c={c} />
            ))}
          </div>
        </section>
      )}

      {full.metrics.length > 0 && (
        <section className="mt-7">
          <div className="font-head text-[16px] font-bold">Data appendix</div>
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
            {full.metrics.map((m, i) => (
              <MetricCard key={i} m={m} compact />
            ))}
          </div>
          {full.appendixSource && (
            <div className="mt-3 text-[12px] text-muted">
              {full.appendixSource}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
