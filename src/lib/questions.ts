// Shared question-type helpers used by the report form and the submitted view.

import { normaliseSheetUrl } from "./sheet-url";

export type QuestionType =
  | "rag"
  | "long_text"
  | "short_text"
  | "single_choice"
  | "multi_choice"
  | "number"
  | "file_link";

export interface QuestionSheet {
  /** What the sheet is for — shown on the contributor's stats card and the
   *  Data sources listing so several sheets stay tellable apart. */
  title?: string;
  /** What the analysis should FOCUS on (e.g. "this week's row; use the
   *  history only for comparison"). Steers the Roundup's narrative and the
   *  contributor's prompt — never which numbers are extracted: facts stay
   *  code-derived (see docs/ARCHITECTURE.md, code-owns-facts). */
  context?: string;
  url: string;
}

export interface QuestionConfig {
  helper?: string;
  options?: string[]; // single_choice / multi_choice
  unit?: string; // number
  skippable?: boolean; // contributor may skip this question
  /** Google Sheets backing THIS question — shown (with live stats) to whoever
   *  answers it, and pulled in as Roundup context alongside the report-level
   *  sheet. Always read through `questionSheets` rather than directly. */
  sheets?: QuestionSheet[];
  /** Legacy single-sheet field from before `sheets` existed. Never written any
   *  more; `questionSheets` still reads it so old questions keep working. */
  sheetUrl?: string;
}

/**
 * The question's Google Sheets, in order. Re-validated on the way out as well
 * as in: these values end up in hrefs and are fetched server-side, and a
 * stored value is only as trustworthy as whatever wrote it — anything that
 * isn't a Google Sheets link (a `javascript:` URL, say) is dropped. The legacy
 * single `sheetUrl` field reads as a one-item list so old questions keep
 * working without a data migration.
 */
export function questionSheets(config: QuestionConfig): QuestionSheet[] {
  const out: QuestionSheet[] = [];
  if (Array.isArray(config.sheets)) {
    for (const entry of config.sheets) {
      if (!entry || typeof entry !== "object") continue;
      const url = normaliseSheetUrl((entry as QuestionSheet).url);
      if (!url) continue;
      const rawTitle = (entry as QuestionSheet).title;
      const title =
        typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : undefined;
      const rawContext = (entry as QuestionSheet).context;
      const context =
        typeof rawContext === "string" && rawContext.trim()
          ? rawContext.trim()
          : undefined;
      out.push({ title, context, url });
    }
  }
  if (out.length === 0) {
    const legacy = normaliseSheetUrl(config.sheetUrl);
    if (legacy) out.push({ url: legacy });
  }
  return out;
}

export const VALID_QUESTION_TYPES = [
  "rag",
  "long_text",
  "short_text",
  "single_choice",
  "multi_choice",
  "number",
  "file_link",
];

export interface CleanedConfig {
  config: Record<string, unknown> | null;
  error: string | null;
}

/**
 * Sanitise a client-supplied question config before storing it. `config` is
 * free-form jsonb, so the one field that must be checked is `sheetUrl` — it is
 * rendered as an href and fetched server-side during generation, so only a
 * real Google Sheets link may be stored (that check is also the SSRF guard),
 * and it is stored normalised. An empty string clears it. Used by both the
 * per-template questions route and the org default-questions route, so the two
 * can't drift.
 */
export function cleanQuestionConfig(config: unknown): CleanedConfig {
  if (config === null || config === undefined) return { config: null, error: null };
  if (typeof config !== "object" || Array.isArray(config)) {
    return { config: null, error: "Invalid question settings" };
  }
  const out = { ...(config as Record<string, unknown>) };

  // Legacy single-sheet field — still accepted from old clients, same rule.
  const raw = out.sheetUrl;
  if (raw === undefined || raw === null || raw === "") {
    delete out.sheetUrl;
  } else {
    const url = normaliseSheetUrl(raw);
    if (!url) {
      return {
        config: null,
        error:
          "That doesn't look like a Google Sheets link — paste the sheet's URL, or leave it blank.",
      };
    }
    out.sheetUrl = url;
  }

  // The sheets list: every entry needs a real Google Sheets link (these are
  // rendered as hrefs and fetched server-side); titles are optional, trimmed,
  // and capped so they stay label-sized. An empty list clears the field.
  if (out.sheets !== undefined) {
    if (!Array.isArray(out.sheets)) {
      return { config: null, error: "Invalid question settings" };
    }
    const sheets: QuestionSheet[] = [];
    for (const entry of out.sheets) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return { config: null, error: "Invalid question settings" };
      }
      const url = normaliseSheetUrl((entry as { url?: unknown }).url);
      if (!url) {
        return {
          config: null,
          error:
            "One of the sheets doesn't look like a Google Sheets link — paste the sheet's URL, or remove that row.",
        };
      }
      const rawTitle = (entry as { title?: unknown }).title;
      const title =
        typeof rawTitle === "string" && rawTitle.trim()
          ? rawTitle.trim().slice(0, 60)
          : undefined;
      const rawContext = (entry as { context?: unknown }).context;
      const context =
        typeof rawContext === "string" && rawContext.trim()
          ? rawContext.trim().slice(0, 500)
          : undefined;
      const sheet: QuestionSheet = { url };
      if (title) sheet.title = title;
      if (context) sheet.context = context;
      sheets.push(sheet);
    }
    if (sheets.length > 0) out.sheets = sheets;
    else delete out.sheets;
  }

  return { config: Object.keys(out).length > 0 ? out : null, error: null };
}

// Sentinel answer value for a deliberately skipped question. Kept as a
// distinct shape so it can never collide with a real answer.
export const SKIPPED_VALUE = { skipped: true } as const;

/** True when an answer value is the "skipped" sentinel. */
export function isSkipped(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { skipped?: unknown }).skipped === true
  );
}

export const TYPE_LABELS: Record<string, string> = {
  rag: "RAG",
  long_text: "Long text",
  short_text: "Short text",
  single_choice: "Single choice",
  multi_choice: "Multi choice",
  number: "Number",
  file_link: "File / Link",
};

export const CHOICE_TYPES = new Set(["single_choice", "multi_choice"]);

export const RAG_CHOICES = [
  { key: "green", label: "Green", sub: "No concerns", color: "#47AB7E" },
  { key: "amber", label: "Amber", sub: "Watching it", color: "#F5B02B" },
  { key: "red", label: "Red", sub: "Needs attention", color: "#E11D48" },
] as const;

const RAG_LABEL: Record<string, string> = {
  green: "Green",
  amber: "Amber",
  red: "Red",
};

export function parseConfig(config: unknown): QuestionConfig {
  if (config && typeof config === "object" && !Array.isArray(config)) {
    return config as QuestionConfig;
  }
  return {};
}

/** Human-readable rendering of an answer value, for read-only summaries. */
export function formatAnswer(
  type: string,
  value: unknown,
  config?: QuestionConfig,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (isSkipped(value)) return "Skipped";

  switch (type) {
    case "rag":
      return RAG_LABEL[String(value)] ?? String(value);
    case "multi_choice":
      return Array.isArray(value) && value.length > 0 ? value.join(", ") : "—";
    case "number": {
      const unit = config?.unit ? ` ${config.unit}` : "";
      return `${value}${unit}`;
    }
    case "file_link": {
      if (typeof value === "object" && value !== null) {
        const v = value as { link?: string; fileName?: string };
        return v.link || v.fileName || "—";
      }
      return String(value);
    }
    default:
      return String(value);
  }
}

/** True when a value counts as "answered" (for progress). */
export function isAnswered(type: string, value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  // A deliberate skip counts as handled — it shouldn't hold up progress.
  if (isSkipped(value)) return true;
  if (type === "multi_choice") return Array.isArray(value) && value.length > 0;
  if (type === "file_link" && typeof value === "object" && value !== null) {
    const v = value as { link?: string; fileName?: string };
    return Boolean(v.link || v.fileName);
  }
  return true;
}
