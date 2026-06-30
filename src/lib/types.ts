// Domain types for the Roundup UI. These mirror the suggested data model in the
// handoff README, trimmed to what the screens render in this UI-first build.

export type Role = "Administrator" | "Contributor" | "Recipient";

export type QuestionType =
  | "rag"
  | "long_text"
  | "short_text"
  | "single_choice"
  | "multi_choice"
  | "number"
  | "file_link";

export type ReportStatus = "Not started" | "In progress" | "Submitted";

export type Rag = "green" | "amber" | "red";

export interface User {
  name: string;
  email: string;
  role: Role;
  /** Assigned report template name, or "—". */
  area: string;
  /** Whether this week's report is in: true = submitted, false = pending, null = N/A (recipient). */
  submitted: boolean | null;
}

export interface AssignedReport {
  id: string;
  title: string;
  area: string;
  qCount: number;
  status: ReportStatus;
  edited: string;
  cta: string;
}

export interface PastWeek {
  week: string;
  range: string;
  when: string;
}

export interface SubmittedAnswer {
  q: string;
  a: string;
}

export interface RiskItem {
  sev: "High" | "Medium" | "Low";
  text: string;
  who: string;
}

export interface ChangeItem {
  dir: "up" | "down";
  text: string;
}

export interface WinItem {
  text: string;
  who: string;
}

export interface MetricItem {
  label: string;
  value: string;
  delta: string;
  good: boolean;
}

export interface RoundupContributor {
  name: string;
  area: string;
  rag: Rag;
  line: string;
}

export interface ReportTemplate {
  title: string;
  qCount: number;
  cadence: string;
  assignees: string[];
  connected: boolean;
  edge: string;
}

export interface BuilderQuestion {
  text: string;
  type: string;
}

export interface DataSourceRow {
  report: string;
  url: string;
  synced: string;
}

export interface RoundupListItem {
  week: string;
  range: string;
  reports: string;
  status: "Pending" | "Draft" | "Sent";
}

export interface ReminderToggle {
  key: string;
  label: string;
  desc: string;
  on: boolean;
}
