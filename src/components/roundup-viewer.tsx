"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, RefreshCw, Send } from "lucide-react";
import { Segmented } from "./segmented";
import { SectionLabel } from "./ui";
import type {
  FullJson,
  MetricItem,
  Rag,
  Severity,
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

function sevClass(sev: Severity): string {
  return sev === "High"
    ? "bg-bad-soft text-bad-ink"
    : sev === "Medium"
      ? "bg-warn-soft text-warn-ink"
      : "bg-line/50 text-muted";
}

function MetricCard({ m, compact = false }: { m: MetricItem; compact?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-line ${
        compact ? "px-4 py-3.5" : "bg-surface px-[18px] py-4"
      }`}
    >
      <div className="text-[12.5px] text-muted">{m.label}</div>
      <div
        className={`mt-1.5 font-head font-bold tracking-[-0.02em] ${
          compact ? "text-[20px]" : "text-[23px]"
        }`}
      >
        {m.value}
      </div>
      {m.delta && (
        <div
          className="mt-1 text-[12.5px] font-bold"
          style={{ color: m.good ? "var(--good)" : "var(--bad)" }}
        >
          {m.delta}
        </div>
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
      <span className="flex items-center gap-[7px] rounded-full bg-good-soft px-4 py-2.5 text-[13.5px] font-semibold text-good-ink">
        <Check size={15} /> Sent to recipients
      </span>
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
}: {
  skim: SkimJson;
  full: FullJson;
  week?: string;
  sent?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("skim");

  return (
    <div className="mx-auto max-w-[880px]">
      <div className="mb-[22px] flex flex-wrap items-center gap-3.5">
        <Link
          href="/roundups"
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-[7px] text-[13px] font-semibold text-muted"
        >
          <ArrowLeft size={15} /> All roundups
        </Link>
        <div className="flex-1" />
        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
        {week && !sent && <RegenerateButton week={week} />}
        {week && <SendButton week={week} initialSent={sent} />}
      </div>

      {mode === "skim" ? <Skim skim={skim} /> : <Full full={full} />}
    </div>
  );
}

function Skim({ skim }: { skim: SkimJson }) {
  const showChanges = skim.changes.length > 0;
  const showHighlights = skim.highlights.length > 0;

  return (
    <div className="fade-up">
      <div className="rounded-card border border-line bg-surface px-8 py-[30px]">
        <div className="text-[12.5px] font-bold tracking-[0.05em] text-muted">
          {skim.week.toUpperCase()} ROUNDUP · {skim.range.toUpperCase()}
        </div>
        <div className="mt-2.5 font-head text-[25px] font-bold leading-[1.25] tracking-[-0.02em]">
          {skim.headline}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted">
          <span>{skim.reportsIn}</span>
          {skim.generated && (
            <>
              <span className="text-line">·</span>
              <span>{skim.generated}</span>
            </>
          )}
        </div>
      </div>

      {skim.risks.length > 0 && (
        <>
          <div className="mb-[11px] mt-[26px] text-[12px] font-bold tracking-[0.06em] text-bad">
            ⚑ NEEDS SENIOR ATTENTION
          </div>
          <div className="flex flex-col gap-2.5">
            {skim.risks.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3.5 rounded-xl border border-line border-l-[3px] border-l-bad bg-surface px-[18px] py-4"
              >
                <span
                  className={`flex-shrink-0 whitespace-nowrap rounded-md px-[9px] py-[3px] text-[11px] font-semibold ${sevClass(
                    r.sev,
                  )}`}
                >
                  {r.sev}
                </span>
                <div className="flex-1">
                  <div className="text-[14.5px] font-medium leading-[1.5]">
                    {r.text}
                  </div>
                  <div className="mt-[5px] text-[12.5px] text-muted">
                    {r.who}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {(showChanges || showHighlights) && (
        <div
          className={`mt-[26px] grid gap-4 ${
            showChanges && showHighlights ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {showChanges && (
            <div>
              <SectionLabel className="mb-[11px]">What changed</SectionLabel>
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                {skim.changes.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-[11px] px-4 py-3.5 ${
                      i > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <span
                      className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[7px] text-[13px] font-extrabold"
                      style={{
                        background:
                          c.dir === "up" ? "var(--good-soft)" : "var(--red-tint)",
                        color: c.dir === "up" ? "var(--good-ink)" : "var(--bad)",
                      }}
                    >
                      {c.dir === "up" ? "↑" : "↓"}
                    </span>
                    <span className="text-sm leading-[1.4]">{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showHighlights && (
            <div>
              <div className="mb-[11px] text-[12px] font-bold uppercase tracking-[0.06em] text-good">
                ★ Highlights
              </div>
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                {skim.highlights.map((w, i) => (
                  <div
                    key={i}
                    className={`px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}
                  >
                    <div className="text-sm font-medium leading-[1.4]">
                      {w.text}
                    </div>
                    <div className="mt-[3px] text-[12px] text-muted">
                      {w.who}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {skim.metrics.length > 0 && (
        <>
          <SectionLabel className="mb-[11px] mt-[26px]">
            Key metrics
          </SectionLabel>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {skim.metrics.map((m, i) => (
              <MetricCard key={i} m={m} />
            ))}
          </div>
        </>
      )}

      {skim.byTeam.length > 0 && (
        <>
          <SectionLabel className="mb-[11px] mt-[26px]">By team</SectionLabel>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {skim.byTeam.map((c, i) => (
              <div
                key={i}
                className={`flex items-center gap-3.5 px-[18px] py-3.5 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <span
                  className="h-[9px] w-[9px] flex-shrink-0 rounded-full"
                  style={{ background: ragColor(c.rag) }}
                />
                <div className="w-[150px] flex-shrink-0">
                  <div className="text-[13.5px] font-semibold">{c.name}</div>
                  <div className="text-[12px] text-muted">{c.area}</div>
                </div>
                <div className="flex-1 text-[13.5px] leading-[1.45]">
                  {c.line}
                </div>
              </div>
            ))}
          </div>
        </>
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
