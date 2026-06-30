"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { Segmented } from "./segmented";
import {
  DEFAULT_SUPPORT_SELECTED,
  FORM_DEFAULTS,
  RAG_OPTIONS,
  SUPPORT_CHIPS,
  TRACK_OPTIONS,
} from "@/lib/data";

type Variant = "cards" | "doc" | "focus";

const VARIANT_OPTIONS = [
  { value: "cards" as const, label: "Cards" },
  { value: "doc" as const, label: "Document" },
  { value: "focus" as const, label: "Focus" },
];

export function ReportForm({ reportId }: { reportId: string }) {
  const [variant, setVariant] = useState<Variant>("cards");
  const [rag, setRag] = useState<string>(FORM_DEFAULTS.rag);
  const [track, setTrack] = useState<string>(FORM_DEFAULTS.track);
  const [support, setSupport] = useState<Set<string>>(
    new Set(DEFAULT_SUPPORT_SELECTED),
  );
  const [headlines, setHeadlines] = useState(FORM_DEFAULTS.headlines);
  const [risks, setRisks] = useState(FORM_DEFAULTS.risks);
  const [oneLine, setOneLine] = useState(FORM_DEFAULTS.oneLine);
  const [number, setNumber] = useState(String(FORM_DEFAULTS.number));

  const colClass =
    variant === "focus"
      ? "mx-auto flex max-w-[640px] flex-col gap-7"
      : variant === "doc"
        ? "mx-auto max-w-[780px] rounded-card border border-line bg-surface px-11 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        : "mx-auto flex max-w-[780px] flex-col gap-4";

  const blockClass =
    variant === "doc"
      ? "border-b border-line py-[26px] last:border-b-0"
      : variant === "focus"
        ? "rounded-card border border-line bg-surface px-8 py-[30px]"
        : "rounded-card border border-line bg-surface px-6 py-[22px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

  const titleSize = variant === "focus" ? "text-[20px]" : "text-[16px]";

  const toggleSupport = (chip: string) =>
    setSupport((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });

  return (
    <div>
      {/* Sub-header */}
      <div className="mx-auto mb-[22px] flex max-w-[780px] flex-wrap items-center gap-4">
        <Link
          href="/my-reports"
          className="flex items-center gap-1.5 rounded-[9px] border border-line px-3 py-[7px] text-[13px] font-semibold text-muted"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden />
          Saved 2 min ago · drafts autosave
        </span>
        <div className="flex-1" />
        <Segmented
          label="Layout"
          options={VARIANT_OPTIONS}
          value={variant}
          onChange={setVariant}
        />
      </div>

      <div className={colClass}>
        {/* Q1 — RAG */}
        <div className={blockClass}>
          <QHeader n={1} title="Overall health this week" titleSize={titleSize}>
            How is your area doing, in a word?
          </QHeader>
          <div className="flex gap-2.5">
            {RAG_OPTIONS.map((opt) => {
              const active = rag === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setRag(opt.key)}
                  className="flex-1 rounded-[13px] p-3.5 text-left"
                  style={{
                    border: active
                      ? `2px solid ${opt.color}`
                      : "2px solid var(--line)",
                    background: active ? `${opt.color}14` : "var(--surface)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-[11px] w-[11px] rounded-full"
                      style={{ background: opt.color }}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: active ? opt.color : "var(--ink)" }}
                    >
                      {opt.label}
                    </span>
                  </span>
                  <div className="mt-[5px] text-[12px] text-muted">
                    {opt.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Q2 — Long text */}
        <div className={blockClass}>
          <QHeader
            n={2}
            title="Headlines — what should the senior team know?"
            titleSize={titleSize}
          >
            The 2–3 things that matter most this week.
          </QHeader>
          <textarea
            value={headlines}
            onChange={(e) => setHeadlines(e.target.value)}
            placeholder="Start typing…"
            className="min-h-[120px] w-full rounded-xl border border-line bg-bg p-3.5 text-[14.5px] leading-[1.6] text-ink"
          />
        </div>

        {/* Q3 — Single choice */}
        <div className={blockClass}>
          <QHeader
            n={3}
            title="Are we on track for the quarter?"
            titleSize={titleSize}
          />
          <div className="flex flex-wrap gap-[9px]">
            {TRACK_OPTIONS.map((opt) => {
              const active = track === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setTrack(opt.key)}
                  className={`rounded-[10px] px-[17px] py-2.5 text-[13.5px] ${
                    active
                      ? "border-[1.5px] border-accent bg-accent-soft font-bold text-accent"
                      : "border-[1.5px] border-line bg-surface font-semibold text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Q4 — Number */}
        <div className={blockClass}>
          <QHeader
            n={4}
            title="Customers onboarded this week"
            titleSize={titleSize}
          >
            A single number.
          </QHeader>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-[120px] rounded-[11px] border border-line bg-bg px-4 py-3 font-head text-[18px] font-bold text-ink"
            />
            <span className="text-[13.5px] text-muted">customers</span>
          </div>
        </div>

        {/* Q5 — Multi choice */}
        <div className={blockClass}>
          <QHeader
            n={5}
            title="Where do you need senior support?"
            titleSize={titleSize}
          >
            Select all that apply.
          </QHeader>
          <div className="flex flex-wrap gap-[9px]">
            {SUPPORT_CHIPS.map((chip) => {
              const active = support.has(chip);
              return (
                <button
                  key={chip}
                  onClick={() => toggleSupport(chip)}
                  className={`rounded-full px-[15px] py-[9px] text-[13px] font-semibold ${
                    active
                      ? "border-[1.5px] border-accent bg-accent text-accent-ink"
                      : "border-[1.5px] border-line bg-surface text-ink"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>

        {/* Q6 — Long text (risk) */}
        <div className={blockClass}>
          <QHeader
            n={6}
            title="Risks & blockers"
            titleSize={titleSize}
            warn
          >
            Anything that could trip us up — be honest.
          </QHeader>
          <textarea
            value={risks}
            onChange={(e) => setRisks(e.target.value)}
            placeholder="What's at risk?"
            className="min-h-[96px] w-full rounded-xl border border-line bg-bg p-3.5 text-[14.5px] leading-[1.6] text-ink"
          />
        </div>

        {/* Q7 — Short text */}
        <div className={blockClass}>
          <QHeader n={7} title="One line for the summary" titleSize={titleSize}>
            If the senior team read one sentence, this is it.
          </QHeader>
          <input
            type="text"
            value={oneLine}
            onChange={(e) => setOneLine(e.target.value)}
            className="w-full rounded-[11px] border border-line bg-bg px-4 py-3 text-[14.5px] text-ink"
          />
        </div>

        {/* Q8 — File / link */}
        <div className={blockClass}>
          <QHeader n={8} title="Attach supporting data" titleSize={titleSize}>
            A file or a link — optional.
          </QHeader>
          <div className="flex flex-wrap items-center gap-3">
            <button className="flex cursor-pointer items-center gap-2.5 rounded-[11px] border border-dashed border-line bg-bg px-[18px] py-3.5 text-[13.5px] text-muted">
              <Upload size={17} /> Drop a file or browse
            </button>
            <span className="text-[13px] text-muted">or</span>
            <input
              type="text"
              placeholder="Paste a link…"
              className="min-w-[200px] flex-1 rounded-[11px] border border-line bg-bg px-4 py-3 text-sm text-ink"
            />
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-[9px] bg-accent-soft px-[13px] py-2 text-[13px] font-semibold text-accent">
            <Upload size={14} />
            {FORM_DEFAULTS.attachment} · attached
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mx-auto mt-6 flex max-w-[780px] flex-wrap items-center gap-3.5">
        <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden />
          All changes saved · editable until Sunday 20:00
        </span>
        <div className="flex-1" />
        <button className="rounded-[11px] border border-line bg-surface px-[22px] py-3 text-sm font-semibold text-ink">
          Save draft
        </button>
        <Link
          href={`/my-reports/${reportId}/submitted`}
          className="rounded-[11px] bg-accent px-[26px] py-3 text-sm font-bold text-accent-ink"
        >
          Submit report
        </Link>
      </div>
    </div>
  );
}

function QHeader({
  n,
  title,
  titleSize,
  warn = false,
  children,
}: {
  n: number;
  title: string;
  titleSize: string;
  warn?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex gap-[13px]">
      <span
        className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg font-head text-[13px] font-bold ${
          warn ? "bg-red-tint text-bad" : "bg-accent-soft text-accent"
        }`}
      >
        {n}
      </span>
      <div>
        <div className={`font-head font-bold ${titleSize}`}>{title}</div>
        {children && (
          <div className="mt-[3px] text-[13.5px] text-muted">{children}</div>
        )}
      </div>
    </div>
  );
}
