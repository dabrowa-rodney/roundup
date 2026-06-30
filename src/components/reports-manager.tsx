"use client";

import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar, SectionLabel } from "./ui";
import {
  BUILDER_QUESTIONS,
  EDITOR_DATA_SOURCE,
  REPORT_TEMPLATES,
} from "@/lib/data";
import { initials } from "@/lib/avatar";
import { avatarColor } from "@/lib/avatar";

export function ReportsManager() {
  const [selected, setSelected] = useState(0);
  const template = REPORT_TEMPLATES[selected];

  return (
    <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[1.3fr_1fr]">
      {/* Left — template list */}
      <div>
        <div className="mb-3.5 flex items-center">
          <SectionLabel className="tracking-[0.05em]">
            Report templates
          </SectionLabel>
          <div className="flex-1" />
          <button className="rounded-[10px] bg-accent px-4 py-[9px] text-[13.5px] font-bold text-accent-ink">
            + New report
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {REPORT_TEMPLATES.map((r, i) => {
            const active = i === selected;
            return (
              <button
                key={r.title}
                onClick={() => setSelected(i)}
                className={`flex items-center gap-3.5 rounded-[14px] border bg-surface px-[18px] py-4 text-left transition-colors ${
                  active ? "border-accent" : "border-line hover:border-accent"
                }`}
                style={{ borderLeft: `3px solid ${r.edge}` }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-head text-[15px] font-bold">
                    {r.title}
                  </div>
                  <div className="mt-[3px] text-[12.5px] text-muted">
                    {r.qCount} questions · {r.cadence}
                  </div>
                </div>
                <div className="flex items-center">
                  {r.assignees.map((name) => (
                    <span
                      key={name}
                      className="-ml-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-surface text-[11px] font-bold text-white first:ml-0"
                      style={{ background: avatarColor(name) }}
                    >
                      {initials(name)}
                    </span>
                  ))}
                </div>
                <span
                  className={`whitespace-nowrap text-[11px] font-bold ${
                    r.connected ? "text-good" : "text-muted"
                  }`}
                >
                  {r.connected ? "● Sheet connected" : "○ No source"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — editor panel */}
      <div className="sticky top-[96px] rounded-card border border-line bg-surface p-[22px]">
        <div className="flex items-center gap-2 text-[12px] font-bold tracking-[0.05em] text-accent">
          <span className="h-[7px] w-[7px] rounded-full bg-accent" />
          EDITING
        </div>
        <input
          key={template.title}
          defaultValue={template.title}
          className="my-1 w-full border-none bg-transparent font-head text-[20px] font-bold tracking-[-0.01em] text-ink outline-none"
        />
        <div className="mb-[18px] flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted">Assigned to</span>
          {template.assignees.map((name) => (
            <span
              key={name}
              className="rounded-[7px] bg-accent-soft px-[9px] py-0.5 text-[12px] font-semibold text-accent"
            >
              {name}
            </span>
          ))}
          <button className="cursor-pointer rounded-[7px] border border-dashed border-line px-[9px] py-0.5 text-[12px] text-muted">
            + assign
          </button>
        </div>

        <SectionLabel className="mb-2.5 tracking-[0.05em]">
          Questions
        </SectionLabel>
        <div className="flex flex-col gap-2">
          {BUILDER_QUESTIONS.map((q) => (
            <div
              key={q.text}
              className="flex items-center gap-[11px] rounded-[11px] border border-line bg-bg px-3 py-[11px]"
            >
              <GripVertical
                size={15}
                className="flex-shrink-0 cursor-grab text-muted"
              />
              <span className="flex-1 truncate text-[13.5px]">{q.text}</span>
              <span className="whitespace-nowrap rounded-[7px] bg-accent-soft px-[9px] py-[3px] text-[11px] font-semibold text-accent">
                {q.type}
              </span>
              <button
                aria-label="Edit question"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-accent-soft hover:text-accent"
              >
                <Pencil size={15} />
              </button>
              <button
                aria-label="Remove question — past answers are kept"
                title="Remove question — past answers are kept"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-tint hover:text-bad"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button className="flex items-center justify-center gap-[7px] rounded-[11px] border border-dashed border-line py-[11px] text-[13.5px] font-semibold text-muted">
            <Plus size={15} /> Add question
          </button>
        </div>

        <div className="mt-[18px] border-t border-line pt-4">
          <SectionLabel className="mb-2 tracking-[0.05em]">
            Data source
          </SectionLabel>
          {template.connected ? (
            <div className="flex items-center gap-2.5 rounded-[11px] border border-line bg-bg px-3 py-[11px]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--good)"
                strokeWidth={2}
                aria-hidden
              >
                <path d="M4 4h16v16H4z" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
              <span className="flex-1 truncate text-[13px] text-muted">
                {EDITOR_DATA_SOURCE}
              </span>
              <span className="text-[11px] font-semibold text-good">
                connected
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-[11px] border border-dashed border-line bg-bg px-3 py-[11px] text-[13px] text-muted">
              No sheet connected — add one on Data sources.
            </div>
          )}
        </div>

        <div className="mt-[18px] flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button className="flex items-center gap-2 rounded-[10px] border border-[#E3C3BC] bg-surface px-[15px] py-[9px] text-[13px] font-semibold text-bad hover:bg-red-tint">
            <Trash2 size={15} /> Archive report
          </button>
          <span className="min-w-[180px] flex-1 text-[12px] leading-[1.4] text-muted">
            Archiving stops the report being assigned for future weeks. Nothing is
            deleted — every past submission stays on record.
          </span>
        </div>
      </div>
    </div>
  );
}
