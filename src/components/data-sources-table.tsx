"use client";

import { useState, useEffect, useCallback } from "react";

const COLS = "grid-cols-[1.3fr_2.1fr_0.9fr_auto]";

interface Row {
  templateId: number;
  report: string;
  url: string;
  saved: string;
}

export function DataSourcesTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setRows(
          data.templates.map((t: { id: number; name: string; dataSourceUrl: string | null }) => ({
            templateId: t.id,
            report: t.name,
            url: t.dataSourceUrl || "",
            saved: t.dataSourceUrl || "",
          }))
        );
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const setUrl = (i: number, value: string) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, url: value } : r))
    );

  const save = async (i: number) => {
    const row = rows[i];
    setSavingId(row.templateId);
    try {
      const res = await fetch(`/api/templates/${row.templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSourceUrl: row.url.trim() }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, saved: r.url } : r
          )
        );
      }
    } catch {} finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted">Loading data sources...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center text-muted">
        No report templates yet. Create one in Reports first.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div
        className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-bold tracking-[0.04em] text-muted`}
      >
        <span>REPORT</span>
        <span>SHEET URL</span>
        <span>STATUS</span>
        <span />
      </div>
      {rows.map((r, i) => {
        const connected = r.saved.trim().length > 0;
        const dirty = r.url !== r.saved;
        const isSaving = savingId === r.templateId;
        return (
          <div
            key={r.templateId}
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
                <span className="rounded-md bg-good-soft px-2.5 py-1 text-[11.5px] font-semibold text-good-ink">
                  Connected
                </span>
              ) : (
                <span className="rounded-md bg-line/50 px-2.5 py-1 text-[11.5px] font-semibold text-muted">
                  Not set
                </span>
              )}
            </span>
            <button
              onClick={() => save(i)}
              disabled={isSaving}
              className={`whitespace-nowrap rounded-[9px] text-[13px] font-semibold ${
                dirty
                  ? "bg-accent px-4 py-2 font-bold text-accent-ink"
                  : "border border-line bg-surface px-3.5 py-2 text-muted"
              }`}
            >
              {isSaving ? "Saving..." : dirty ? "Save" : connected ? "Saved ✓" : "Save"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
