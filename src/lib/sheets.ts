// Google Sheets → Roundup metrics (quick, no-auth version).
//
// Reads a link-shared sheet via its public CSV export. Convention: column 1 is
// the period/label column; every other column is a metric series (header = name,
// latest non-empty cell = value, change vs the previous non-empty cell = delta).
//
// For PRIVATE sheets this won't work — that needs a Google service account + the
// Sheets API (a later upgrade); this path relies on "anyone with the link can view".

import type { MetricItem } from "./roundup";

/** Build the CSV-export URL for a Google Sheets link, or null if not one. */
export function sheetCsvUrl(url: string): string | null {
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) return null;
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${
    gid ? `&gid=${gid}` : ""
  }`;
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields with commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseNumber(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/** Leading non-numeric prefix (e.g. a currency symbol) to reuse on the delta. */
function unitPrefix(s: string): string {
  return s.match(/^[^\d.\-]+/)?.[0].trim() ?? "";
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

/** Turn parsed CSV rows into metrics (latest value + delta per data column). */
export function extractMetrics(rows: string[][]): MetricItem[] {
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (clean.length < 2) return [];
  const header = clean[0];
  const metrics: MetricItem[] = [];

  for (let col = 1; col < header.length; col++) {
    const label = (header[col] ?? "").trim();
    if (!label) continue;
    const series = clean
      .slice(1)
      .map((r) => (r[col] ?? "").trim())
      .filter((v) => v !== "");
    if (series.length === 0) continue;

    const latest = series[series.length - 1];
    const prev = series.length > 1 ? series[series.length - 2] : undefined;
    const latestNum = parseNumber(latest);
    const prevNum = prev !== undefined ? parseNumber(prev) : null;

    let delta = "";
    let good = true;
    if (latestNum !== null && prevNum !== null) {
      const d = latestNum - prevNum;
      good = d >= 0;
      delta = `${d >= 0 ? "↑" : "↓"} ${unitPrefix(latest)}${formatNumber(Math.abs(d))}`;
    }
    metrics.push({ label, value: latest, delta, good });
  }
  return metrics;
}

/** Fetch a connected sheet and return its metrics (never throws). */
export async function fetchSheetMetrics(url: string): Promise<MetricItem[]> {
  const csvUrl = sheetCsvUrl(url);
  if (!csvUrl) return [];
  try {
    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const text = await res.text();
    // A private/redirected sheet returns an HTML sign-in page, not CSV.
    if (text.trimStart().startsWith("<")) return [];
    return extractMetrics(parseCsv(text));
  } catch {
    return [];
  }
}
