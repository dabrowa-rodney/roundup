"use client";

interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** Pill segmented control (Layout switcher, Skim/Full toggle). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted">
      {label}
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-0.5 rounded-[11px] bg-line p-[3px]"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.value)}
              className={`cursor-pointer rounded-lg border-none px-[13px] py-1.5 text-[12.5px] font-semibold transition-colors ${
                active
                  ? "bg-surface text-ink shadow-[0_1px_3px_rgba(39,50,94,0.14)]"
                  : "bg-transparent text-muted"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
