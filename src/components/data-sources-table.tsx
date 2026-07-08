"use client";

import { useState, useEffect, useCallback } from "react";

const COLS = "min-w-[640px] grid-cols-[1.3fr_2.1fr_0.9fr_auto]";

interface Row {
  templateId: number;
  report: string;
  url: string;
  saved: string;
}

interface Metric {
  label: string;
  value: string;
  delta: string;
  good: boolean;
}

interface Preview {
  loading: boolean;
  ok?: boolean;
  reason?: string;
  metrics?: Metric[];
}

function PreviewLine({ p }: { p?: Preview }) {
  if (!p) return null;
  if (p.loading) {
    return (
      <div className="px-[22px] pb-2.5 text-[12.5px] text-muted">
        Checking sheet…
      </div>
    );
  }
  if (!p.ok) {
    const msg =
      p.reason === "not_shared"
        ? "Couldn't read the sheet — set sharing to “Anyone with the link can view”."
        : p.reason === "invalid_url"
          ? "That doesn't look like a Google Sheets link."
          : "Couldn't reach the sheet. Try again in a moment.";
    return (
      <div className="px-[22px] pb-2.5 text-[12.5px] font-medium text-bad">
        ✗ {msg}
      </div>
    );
  }
  if (!p.metrics || p.metrics.length === 0) {
    return (
      <div className="px-[22px] pb-2.5 text-[12.5px] text-muted">
        ✓ Reachable, but no metric columns found (expected a period column plus
        value columns).
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-[22px] pb-3 text-[12.5px]">
      <span className="font-semibold text-good-ink">
        ✓ {p.metrics.length} metric{p.metrics.length === 1 ? "" : "s"} will pull:
      </span>
      {p.metrics.slice(0, 4).map((m, i) => (
        <span key={i} className="text-muted">
          <span className="font-medium text-ink">{m.label}:</span> {m.value}
          {m.delta ? ` (${m.delta})` : ""}
        </span>
      ))}
      {p.metrics.length > 4 && (
        <span className="text-muted">+{p.metrics.length - 4} more</span>
      )}
    </div>
  );
}

export function DataSourcesTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [previews, setPreviews] = useState<Record<number, Preview | undefined>>(
    {},
  );

  const runPreview = useCallback(async (templateId: number, url: string) => {
    if (!url.trim()) {
      setPreviews((p) => ({ ...p, [templateId]: undefined }));
      return;
    }
    setPreviews((p) => ({ ...p, [templateId]: { loading: true } }));
    try {
      const res = await fetch(
        `/api/sheets/preview?url=${encodeURIComponent(url.trim())}`,
      );
      const data = await res.json();
      setPreviews((p) => ({
        ...p,
        [templateId]: {
          loading: false,
          ok: data.ok,
          reason: data.reason,
          metrics: data.metrics,
        },
      }));
    } catch {
      setPreviews((p) => ({
        ...p,
        [templateId]: { loading: false, ok: false, reason: "fetch_failed" },
      }));
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        const active = data.templates.filter(
          (t: { archivedAt: string | null }) => !t.archivedAt,
        );
        const mapped: Row[] = active.map(
          (t: { id: number; name: string; dataSourceUrl: string | null }) => ({
            templateId: t.id,
            report: t.name,
            url: t.dataSourceUrl || "",
            saved: t.dataSourceUrl || "",
          }),
        );
        setRows(mapped);
        // Auto-preview any already-connected sheets.
        mapped.forEach((r) => {
          if (r.saved.trim()) runPreview(r.templateId, r.saved);
        });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [runPreview]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const setUrl = (i: number, value: string) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, url: value } : r)),
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
          prev.map((r, idx) => (idx === i ? { ...r, saved: r.url } : r)),
        );
        runPreview(row.templateId, row.url);
      }
    } catch {
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-muted">Loading data sources...</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center text-muted">
        No report templates yet. Create one in Reports first.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <div
        className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted`}
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
          <div key={r.templateId} className="border-t border-line">
            <div
              className={`grid ${COLS} items-center gap-3.5 px-[22px] py-3`}
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
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => runPreview(r.templateId, r.url)}
                  disabled={!r.url.trim()}
                  className="whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink disabled:opacity-40"
                >
                  Test
                </button>
                <button
                  onClick={() => save(i)}
                  disabled={isSaving}
                  className={`whitespace-nowrap rounded-full text-[13px] font-semibold ${
                    dirty
                      ? "bg-accent px-4 py-2 font-bold text-accent-ink"
                      : "border border-line bg-surface px-3.5 py-2 text-muted"
                  }`}
                >
                  {isSaving
                    ? "Saving..."
                    : dirty
                      ? "Save"
                      : connected
                        ? "Saved ✓"
                        : "Save"}
                </button>
              </div>
            </div>
            <PreviewLine p={previews[r.templateId]} />
          </div>
        );
      })}
    </div>
  );
}
