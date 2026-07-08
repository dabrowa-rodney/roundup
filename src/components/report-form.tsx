"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, Upload } from "lucide-react";
import { Segmented } from "./segmented";
import {
  isSkipped,
  parseConfig,
  RAG_CHOICES,
  SKIPPED_VALUE,
  type QuestionConfig,
} from "@/lib/questions";

interface FormQuestion {
  id: number;
  text: string;
  type: string;
  config: unknown;
}

type Variant = "cards" | "doc" | "focus";

const VARIANT_OPTIONS = [
  { value: "cards" as const, label: "Cards" },
  { value: "doc" as const, label: "Document" },
  { value: "focus" as const, label: "Focus" },
];

export function ReportForm({
  instanceId,
  templateId,
  locked,
  questions,
  initialValues,
}: {
  instanceId: number;
  templateId: number;
  locked: boolean;
  questions: FormQuestion[];
  initialValues: Record<number, unknown>;
}) {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("cards");
  const [values, setValues] = useState<Record<number, unknown>>(initialValues);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [submitting, setSubmitting] = useState(false);

  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  const firstRender = useRef(true);

  const setValue = (qid: number, value: unknown) =>
    setValues((prev) => ({ ...prev, [qid]: value }));

  const save = useCallback(
    async (submit: boolean): Promise<boolean> => {
      if (locked) return false;
      setSaveState("saving");
      const payload = {
        submit,
        answers: questions
          .map((q) => ({ questionId: q.id, value: valuesRef.current[q.id] }))
          .filter((a) => a.value !== undefined),
      };
      try {
        const res = await fetch(`/api/instances/${instanceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        setSaveState("saved");
        return true;
      } catch {
        setSaveState("error");
        return false;
      }
    },
    [instanceId, locked, questions],
  );

  // Debounced autosave whenever answers change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (locked) return;
    const t = setTimeout(() => save(false), 800);
    return () => clearTimeout(t);
  }, [values, save, locked]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const ok = await save(true);
    setSubmitting(false);
    if (ok) router.push(`/my-reports/${templateId}/submitted`);
  };

  const colClass =
    variant === "focus"
      ? "mx-auto flex max-w-[640px] flex-col gap-7"
      : variant === "doc"
        ? "mx-auto max-w-[780px] rounded-card border border-line bg-surface px-11 py-1.5"
        : "mx-auto flex max-w-[780px] flex-col gap-4";
  const blockClass =
    variant === "doc"
      ? "border-b border-line py-[26px] last:border-b-0"
      : variant === "focus"
        ? "rounded-card border border-line bg-surface px-8 py-[30px]"
        : "rounded-card border border-line bg-surface px-6 py-[22px]";
  const titleSize = variant === "focus" ? "text-[20px]" : "text-[16px]";

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Couldn't save — will retry"
        : saveState === "saved"
          ? "Saved · drafts autosave"
          : "Drafts autosave";
  const saveDotColor =
    saveState === "error" ? "bg-bad" : saveState === "saving" ? "bg-warn" : "bg-good";

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-[780px] rounded-card border border-dashed border-line bg-surface p-10 text-center">
        <div className="font-head text-[18px] font-bold">No questions yet</div>
        <p className="mx-auto mt-1.5 max-w-[420px] text-[14px] text-muted">
          This report has no questions. An administrator can add them in the
          Reports section.
        </p>
        <Link
          href="/my-reports"
          className="mt-4 inline-block rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:border-accent"
        >
          ← Back to my reports
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-header */}
      <div className="mx-auto mb-[22px] flex max-w-[780px] flex-wrap items-center gap-4">
        <Link
          href="/my-reports"
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-[7px] text-[13px] font-semibold text-muted"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        {locked ? (
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            <Lock size={13} /> Locked — the window has closed
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${saveDotColor}`} aria-hidden />
            {saveLabel}
          </span>
        )}
        <div className="flex-1" />
        <Segmented
          label="Layout"
          options={VARIANT_OPTIONS}
          value={variant}
          onChange={setVariant}
        />
      </div>

      <fieldset
        disabled={locked}
        className={locked ? "opacity-70" : undefined}
      >
        <div className={colClass}>
          {questions.map((q, i) => (
            <div key={q.id} className={blockClass}>
              <QuestionField
                index={i}
                question={q}
                value={values[q.id]}
                onChange={(v) => setValue(q.id, v)}
                titleSize={titleSize}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* Footer */}
      {!locked && (
        <div className="mx-auto mt-6 flex max-w-[780px] flex-wrap items-center gap-3.5">
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${saveDotColor}`} aria-hidden />
            {saveLabel}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => save(false)}
            disabled={saveState === "saving"}
            className="rounded-full border border-line bg-surface px-[22px] py-3 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full bg-accent px-[26px] py-3 text-sm font-bold text-accent-ink disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit report"}
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionField({
  index,
  question,
  value,
  onChange,
  titleSize,
}: {
  index: number;
  question: FormQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  titleSize: string;
}) {
  const config = parseConfig(question.config);
  const skipped = isSkipped(value);
  // Remember the pre-skip draft so un-skipping restores it. null (not
  // undefined) so the save payload overwrites a previously-saved skip.
  const [stashed, setStashed] = useState<unknown>(null);

  const toggleSkip = () => {
    if (skipped) {
      onChange(stashed);
    } else {
      setStashed(value === undefined ? null : value);
      onChange(SKIPPED_VALUE);
    }
  };

  return (
    <>
      <div className="mb-3.5 flex gap-[13px]">
        <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-accent-soft font-head text-[13px] font-bold text-accent">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`font-head font-bold ${titleSize}`}>
            {question.text}
          </div>
          {config.helper && (
            <div className="mt-[3px] text-[13.5px] text-muted">
              {config.helper}
            </div>
          )}
        </div>
        {config.skippable && (
          <button
            type="button"
            role="switch"
            aria-checked={skipped}
            onClick={toggleSkip}
            className={`flex h-fit flex-shrink-0 items-center gap-2 rounded-full border px-3 py-[6px] text-[12px] font-semibold transition-colors ${
              skipped
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:border-accent hover:text-accent"
            }`}
          >
            Skip this week
            <span
              aria-hidden
              className={`relative inline-block h-[14px] w-[24px] rounded-full transition-colors ${
                skipped ? "bg-accent" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-[2px] h-[10px] w-[10px] rounded-full bg-surface transition-all ${
                  skipped ? "left-[12px]" : "left-[2px]"
                }`}
              />
            </span>
          </button>
        )}
      </div>
      {skipped ? (
        <div className="rounded-[11px] border border-dashed border-line bg-bg px-4 py-3 text-[13px] text-muted">
          Skipped this week — it won&apos;t appear in the Roundup.
        </div>
      ) : (
        <Input question={question} config={config} value={value} onChange={onChange} />
      )}
    </>
  );
}

function Input({
  question,
  config,
  value,
  onChange,
}: {
  question: FormQuestion;
  config: QuestionConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (question.type) {
    case "rag":
      return (
        <div className="flex flex-wrap gap-2.5">
          {RAG_CHOICES.map((opt) => {
            const active = value === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChange(opt.key)}
                className="min-w-[140px] flex-1 rounded-[13px] p-3.5 text-left"
                style={{
                  border: active ? `2px solid ${opt.color}` : "2px solid var(--line)",
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
                <div className="mt-[5px] text-[12px] text-muted">{opt.sub}</div>
              </button>
            );
          })}
        </div>
      );

    case "long_text":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Start typing…"
          className="min-h-[120px] w-full rounded-xl border border-line bg-bg p-3.5 text-[14.5px] leading-[1.6] text-ink"
        />
      );

    case "short_text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[11px] border border-line bg-bg px-4 py-3 text-[14.5px] text-ink"
        />
      );

    case "single_choice": {
      const options = config.options ?? [];
      if (options.length === 0) return <NoOptions />;
      return (
        <div className="flex flex-wrap gap-[9px]">
          {options.map((opt) => {
            const active = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`rounded-[10px] px-[17px] py-2.5 text-[13.5px] ${
                  active
                    ? "border-[1.5px] border-accent bg-accent-soft font-bold text-accent"
                    : "border-[1.5px] border-line bg-surface font-semibold text-ink"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    case "multi_choice": {
      const options = config.options ?? [];
      if (options.length === 0) return <NoOptions />;
      const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string) =>
        onChange(
          selected.includes(opt)
            ? selected.filter((x) => x !== opt)
            : [...selected, opt],
        );
      return (
        <div className="flex flex-wrap gap-[9px]">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`rounded-full px-[15px] py-[9px] text-[13px] font-semibold ${
                  active
                    ? "border-[1.5px] border-accent bg-accent text-accent-ink"
                    : "border-[1.5px] border-line bg-surface text-ink"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    case "number":
      return (
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={
              typeof value === "number" || typeof value === "string"
                ? String(value)
                : ""
            }
            onChange={(e) => onChange(e.target.value)}
            className="w-[120px] rounded-[11px] border border-line bg-bg px-4 py-3 font-head text-[18px] font-bold text-ink"
          />
          {config.unit && (
            <span className="text-[13.5px] text-muted">{config.unit}</span>
          )}
        </div>
      );

    case "file_link":
      return (
        <div>
          <input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste a link…"
            className="w-full rounded-[11px] border border-line bg-bg px-4 py-3 text-sm text-ink"
          />
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
            <Upload size={13} /> File uploads are coming soon — paste a link for
            now.
          </div>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[11px] border border-line bg-bg px-4 py-3 text-[14.5px] text-ink"
        />
      );
  }
}

function NoOptions() {
  return (
    <div className="rounded-[11px] border border-dashed border-line bg-bg px-4 py-3 text-[13px] text-muted">
      No options configured yet — an administrator can add them in Reports.
    </div>
  );
}
