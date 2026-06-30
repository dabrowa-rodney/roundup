"use client";

import { useState } from "react";
import { DATA_SOURCES } from "@/lib/data";

const COLS = "grid-cols-[1.3fr_2.1fr_0.9fr_0.9fr_auto]";

interface Row {
  report: string;
  url: string; // current (possibly edited) value
  saved: string; // last persisted value
  synced: string;
}

export function DataSourcesTable() {
  const [rows, setRows] = useState<Row[]>(
    DATA_SOURCES.map((d) => ({
      report: d.report,
      url: d.url,
      saved: d.url,
      synced: d.synced,
    })),
  );

  const setUrl = (i: number, value: string) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, url: value } : r)),
    );

  const save = (i: number) =>
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? {
              ...r,
              saved: r.url,
              synced: r.url.trim() ? "Just now" : "—",
            }
          : r,
      ),
    );

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div
        className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-bold tracking-[0.04em] text-muted`}
      >
        <span>REPORT</span>
        <span>SHEET URL</span>
        <span>STATUS</span>
        <span>LAST SYNCED</span>
        <span />
      </div>
      {rows.map((r, i) => {
        const connected = r.saved.trim().length > 0;
        const dirty = r.url !== r.saved;
        return (
          <div
            key={r.report}
            className={`grid ${COLS} items-center gap-3.5 border-t border-line px-[22px] py-3`}
          >
            <span className="text-sm font-semibold">{r.report}</span>
            <input
              value={r.url}
              onChange={(e) => setUrl(i, e.target.value)}
              placeholder="Paste Google Sheet URL…"
              className="w-full rounded-[9px] border border-line bg-bg px-3 py-[9px] font-mono text-[13px] text-ink"
            />
            <span>
              {connected ? (
                <span className="rounded-[7px] bg-good px-2.5 py-1 text-[11.5px] font-bold text-white">
                  Connected
                </span>
              ) : (
                <span className="rounded-[7px] bg-red-tint px-2.5 py-1 text-[11.5px] font-bold text-bad">
                  Not set
                </span>
              )}
            </span>
            <span className="text-[13px] text-muted">{r.synced}</span>
            <button
              onClick={() => save(i)}
              className={`whitespace-nowrap rounded-[9px] text-[13px] font-semibold ${
                dirty
                  ? "bg-accent px-4 py-2 font-bold text-accent-ink"
                  : "border border-line bg-surface px-3.5 py-2 text-muted"
              }`}
            >
              {dirty ? "Save" : connected ? "Saved" : "Save"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
