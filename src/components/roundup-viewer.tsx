"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { Segmented } from "./segmented";
import { SectionLabel } from "./ui";
import {
  ROUNDUP_CHANGES,
  ROUNDUP_CONTRIBUTORS,
  ROUNDUP_FULL,
  ROUNDUP_META,
  ROUNDUP_METRICS,
  ROUNDUP_RISKS,
  ROUNDUP_WINS,
} from "@/lib/data";
import type { MetricItem, Rag, RiskItem } from "@/lib/types";

type Mode = "skim" | "full";

const MODE_OPTIONS = [
  { value: "skim" as const, label: "Skim" },
  { value: "full" as const, label: "Full report" },
];

const RAG_COLOR: Record<Rag, string> = {
  green: "#2E7D55",
  amber: "#C2912B",
  red: "#C2493C",
};

function sevClass(sev: RiskItem["sev"]): string {
  return sev === "High" ? "bg-bad" : sev === "Medium" ? "bg-warn" : "bg-muted";
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
      <div
        className="mt-1 text-[12.5px] font-bold"
        style={{ color: m.good ? "var(--good)" : "var(--bad)" }}
      >
        {m.delta}
      </div>
    </div>
  );
}

export function RoundupViewer() {
  const [mode, setMode] = useState<Mode>("skim");

  return (
    <div className="mx-auto max-w-[880px]">
      <div className="mb-[22px] flex flex-wrap items-center gap-3.5">
        <Link
          href="/roundups"
          className="flex items-center gap-1.5 rounded-[9px] border border-line px-3 py-[7px] text-[13px] font-semibold text-muted"
        >
          <ArrowLeft size={15} /> All roundups
        </Link>
        <div className="flex-1" />
        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
        <button className="flex items-center gap-[7px] rounded-[10px] border border-line bg-surface px-4 py-2.5 text-[13.5px] font-semibold text-ink">
          <Share2 size={15} /> Share
        </button>
      </div>

      {mode === "skim" ? <Skim /> : <Full />}
    </div>
  );
}

function Skim() {
  return (
    <div className="fade-up">
      <div className="rounded-card border border-line bg-surface px-8 py-[30px]">
        <div className="text-[12.5px] font-bold tracking-[0.05em] text-muted">
          {ROUNDUP_META.week}
        </div>
        <div className="mt-2.5 font-head text-[25px] font-bold leading-[1.25] tracking-[-0.02em]">
          {ROUNDUP_META.headline}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted">
          <span>{ROUNDUP_META.reportsIn}</span>
          <span className="text-line">·</span>
          <span>{ROUNDUP_META.generated}</span>
          <span className="text-line">·</span>
          <span>{ROUNDUP_META.readTime}</span>
        </div>
      </div>

      <div className="mb-[11px] mt-[26px] text-[12px] font-bold tracking-[0.06em] text-bad">
        ⚑ NEEDS SENIOR ATTENTION
      </div>
      <div className="flex flex-col gap-2.5">
        {ROUNDUP_RISKS.map((r) => (
          <div
            key={r.text}
            className="flex items-start gap-3.5 rounded-xl border border-line border-l-[3px] border-l-bad bg-surface px-[18px] py-4"
          >
            <span
              className={`flex-shrink-0 whitespace-nowrap rounded-md px-[9px] py-[3px] text-[11px] font-bold text-white ${sevClass(
                r.sev,
              )}`}
            >
              {r.sev}
            </span>
            <div className="flex-1">
              <div className="text-[14.5px] font-medium leading-[1.5]">
                {r.text}
              </div>
              <div className="mt-[5px] text-[12.5px] text-muted">{r.who}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[26px] grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <SectionLabel className="mb-[11px]">What changed</SectionLabel>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {ROUNDUP_CHANGES.map((c, i) => (
              <div
                key={c.text}
                className={`flex items-center gap-[11px] px-4 py-3.5 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <span
                  className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[7px] text-[13px] font-extrabold"
                  style={{
                    background: c.dir === "up" ? "var(--accent-soft)" : "var(--red-tint)",
                    color: c.dir === "up" ? "var(--good)" : "var(--bad)",
                  }}
                >
                  {c.dir === "up" ? "↑" : "↓"}
                </span>
                <span className="text-sm leading-[1.4]">{c.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-[11px] text-[12px] font-bold uppercase tracking-[0.06em] text-good">
            ★ Highlights
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {ROUNDUP_WINS.map((w, i) => (
              <div
                key={w.text}
                className={`px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="text-sm font-medium leading-[1.4]">{w.text}</div>
                <div className="mt-[3px] text-[12px] text-muted">{w.who}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionLabel className="mb-[11px] mt-[26px]">
        Key metrics · from connected sheets
      </SectionLabel>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {ROUNDUP_METRICS.map((m) => (
          <MetricCard key={m.label} m={m} />
        ))}
      </div>

      <SectionLabel className="mb-[11px] mt-[26px]">By team</SectionLabel>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {ROUNDUP_CONTRIBUTORS.map((c, i) => (
          <div
            key={c.name}
            className={`flex items-center gap-3.5 px-[18px] py-3.5 ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <span
              className="h-[9px] w-[9px] flex-shrink-0 rounded-full"
              style={{ background: RAG_COLOR[c.rag] }}
            />
            <div className="w-[150px] flex-shrink-0">
              <div className="text-[13.5px] font-semibold">{c.name}</div>
              <div className="text-[12px] text-muted">{c.area}</div>
            </div>
            <div className="flex-1 text-[13.5px] leading-[1.45]">{c.line}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Full() {
  return (
    <div className="fade-up rounded-card border border-line bg-surface px-6 py-10 md:px-14 md:py-12">
      <div className="text-[12.5px] font-bold tracking-[0.06em] text-muted">
        WEEKLY ROUNDUP
      </div>
      <h1 className="mb-1.5 mt-2.5 font-head text-[32px] font-bold leading-[1.15] tracking-[-0.025em]">
        {ROUNDUP_FULL.title}
      </h1>
      <div className="border-b border-line pb-[22px] text-[13.5px] text-muted">
        {ROUNDUP_FULL.subtitle}
      </div>

      <section className="mt-[26px]">
        <div className="font-head text-[16px] font-bold tracking-[0.02em] text-accent">
          Executive summary
        </div>
        <p className="mt-2.5 text-[15.5px] leading-[1.75]">
          {ROUNDUP_FULL.execSummary}
        </p>
      </section>

      <section className="mt-7">
        <div className="font-head text-[16px] font-bold text-bad">
          Risks needing attention
        </div>
        <ol className="ml-5 mt-2.5 list-decimal text-[15px] leading-[1.7]">
          {ROUNDUP_FULL.risks.map((r, i) => (
            <li
              key={i}
              className="mb-2 last:mb-0"
              dangerouslySetInnerHTML={{ __html: r }}
            />
          ))}
        </ol>
      </section>

      <section className="mt-7">
        <div className="font-head text-[16px] font-bold">
          What changed since last week
        </div>
        <ul className="ml-5 mt-2.5 list-disc text-[15px] leading-[1.7]">
          {ROUNDUP_FULL.changed.map((c) => (
            <li key={c} className="mb-1.5 last:mb-0">
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7">
        <div className="font-head text-[16px] font-bold text-good">Highlights</div>
        <ul className="ml-5 mt-2.5 list-disc text-[15px] leading-[1.7]">
          {ROUNDUP_FULL.highlights.map((h) => (
            <li key={h} className="mb-1.5 last:mb-0">
              {h}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7">
        <div className="font-head text-[16px] font-bold">By team</div>
        <div className="mt-3 flex flex-col">
          {ROUNDUP_CONTRIBUTORS.map((c) => (
            <div key={c.name} className="flex gap-3.5 border-t border-line py-3.5">
              <span
                className="mt-1.5 h-[9px] w-[9px] flex-shrink-0 rounded-full"
                style={{ background: RAG_COLOR[c.rag] }}
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

      <section className="mt-7">
        <div className="font-head text-[16px] font-bold">Data appendix</div>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
          {ROUNDUP_METRICS.map((m) => (
            <MetricCard key={m.label} m={m} compact />
          ))}
        </div>
        <div className="mt-3 text-[12px] text-muted">
          {ROUNDUP_FULL.appendixSource}
        </div>
      </section>
    </div>
  );
}
