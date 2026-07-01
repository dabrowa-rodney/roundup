// Shared question-type helpers used by the report form and the submitted view.

export type QuestionType =
  | "rag"
  | "long_text"
  | "short_text"
  | "single_choice"
  | "multi_choice"
  | "number"
  | "file_link";

export interface QuestionConfig {
  helper?: string;
  options?: string[]; // single_choice / multi_choice
  unit?: string; // number
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
  { key: "green", label: "Green", sub: "No concerns", color: "#2E7D55" },
  { key: "amber", label: "Amber", sub: "Watching it", color: "#C2912B" },
  { key: "red", label: "Red", sub: "Needs attention", color: "#C2493C" },
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
  if (type === "multi_choice") return Array.isArray(value) && value.length > 0;
  if (type === "file_link" && typeof value === "object" && value !== null) {
    const v = value as { link?: string; fileName?: string };
    return Boolean(v.link || v.fileName);
  }
  return true;
}
