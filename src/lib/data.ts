// Mock data for the UI-first build. Lifted verbatim from the design prototype
// (Roundup.dc.html) so the recreated screens match the handoff exactly.
// In production this is replaced by data from the backend / database.

import type {
  AssignedReport,
  BuilderQuestion,
  ChangeItem,
  DataSourceRow,
  MetricItem,
  PastWeek,
  ReminderToggle,
  ReportTemplate,
  RiskItem,
  RoundupContributor,
  RoundupListItem,
  SubmittedAnswer,
  User,
  WinItem,
} from "./types";

export const CURRENT_USER = {
  name: "Maya Okafor",
  email: "maya.okafor@yourcompany.com",
  role: "Administrator" as const,
};

export const WEEK_LABEL = "Week 26 · 22–28 Jun 2026";

// Deadline pill — anchored 30h out (matches the prototype's countdown seed).
export const DEADLINE_HOURS_AHEAD = 30;

export const ASSIGNED_REPORTS: AssignedReport[] = [
  {
    id: "customer-success",
    title: "Customer Success",
    area: "Weekly Update",
    qCount: 8,
    status: "In progress",
    edited: "Edited 2 min ago",
    cta: "Continue",
  },
  {
    id: "people-talent",
    title: "People & Talent",
    area: "Weekly Update",
    qCount: 6,
    status: "Not started",
    edited: "Not started yet",
    cta: "Start",
  },
];

export const PAST_WEEKS: PastWeek[] = [
  { week: "Week 25", range: "15–21 Jun", when: "Sun 18:40" },
  { week: "Week 24", range: "8–14 Jun", when: "Sun 19:12" },
  { week: "Week 23", range: "1–7 Jun", when: "Sat 16:55" },
];

// Report form — the questions for the "Customer Success" template.
export const RAG_OPTIONS = [
  { key: "green", label: "Green", sub: "No concerns", color: "#2E7D55" },
  { key: "amber", label: "Amber", sub: "Watching it", color: "#C2912B" },
  { key: "red", label: "Red", sub: "Needs attention", color: "#C2493C" },
] as const;

export const TRACK_OPTIONS = [
  { key: "ahead", label: "Ahead" },
  { key: "ontrack", label: "On track" },
  { key: "atrisk", label: "At risk" },
  { key: "behind", label: "Behind" },
] as const;

export const SUPPORT_CHIPS = [
  "Hiring",
  "Budget",
  "Cross-team support",
  "Exec intro",
  "None",
] as const;

export const DEFAULT_SUPPORT_SELECTED = ["Hiring", "Cross-team support"];

export const FORM_DEFAULTS = {
  rag: "amber" as const,
  track: "ontrack",
  headlines:
    "Closed Northgate Trust — our largest deal of the quarter. Release 4.2 shipped on schedule. Support volume is up after the launch and we're watching it.",
  number: 7,
  risks:
    "Two enterprise deals pushed to Q3, so pipeline coverage dropped to 1.7x. Need an exec intro for the Halden Group renewal.",
  oneLine: "Big win on Northgate, but pipeline needs attention before Q3.",
  attachment: "CS-metrics-wk26.xlsx",
};

export const SUBMITTED_ANSWERS: SubmittedAnswer[] = [
  { q: "Overall health", a: "Amber — some risk, watching it" },
  {
    q: "Headlines",
    a: "Closed Northgate Trust, our largest deal of the quarter. Release 4.2 shipped on schedule. Support volume up after the launch.",
  },
  { q: "On track for the quarter?", a: "On track" },
  { q: "Customers onboarded", a: "7" },
  { q: "Where you need senior support", a: "Hiring, Cross-team support" },
  {
    q: "Risks & blockers",
    a: "Two enterprise deals pushed to Q3; pipeline coverage at 1.7x. Need an exec intro for the Halden renewal.",
  },
];

// Roundup viewer (Week 25).
export const ROUNDUP_META = {
  week: "WEEK 25 ROUNDUP · 15–21 JUN 2026",
  headline:
    "A strong week on delivery and revenue, tempered by softening sales pipeline and a post-release support spike.",
  reportsIn: "9 of 10 reports in",
  generated: "Generated Sun 21 Jun, 21:04",
  readTime: "~90 sec read",
};

export const ROUNDUP_RISKS: RiskItem[] = [
  {
    sev: "High",
    text: "Sales pipeline coverage dropped to 1.7x — two enterprise deals pushed to Q3.",
    who: "Sales · Priya Shah",
  },
  {
    sev: "Medium",
    text: "Support backlog up ~240 tickets after release 4.2; SLA at 94% and easing.",
    who: "Support Ops · Aisha Bello",
  },
  {
    sev: "Low",
    text: "Data dashboard migration ~1 week behind; one upstream source intermittently failing.",
    who: "Data & Insights · Hugo Frost",
  },
];

export const ROUNDUP_CHANGES: ChangeItem[] = [
  { dir: "up", text: "Onboarding time 4.4 → 3.1 days" },
  { dir: "up", text: "NPS 41 → 46" },
  { dir: "down", text: "Pipeline coverage 2.1x → 1.7x" },
  { dir: "down", text: "Support backlog +240 tickets" },
];

export const ROUNDUP_WINS: WinItem[] = [
  { text: "Closed Northgate Trust — largest deal of the quarter", who: "Sales" },
  { text: "Release 4.2 shipped on schedule", who: "Product & Engineering" },
  { text: "Two senior offers accepted", who: "People & Talent" },
  { text: "June revenue 4% above forecast", who: "Finance" },
];

export const ROUNDUP_METRICS: MetricItem[] = [
  { label: "Onboarding time", value: "3.1 days", delta: "↓ 1.3 days", good: true },
  { label: "Pipeline coverage", value: "1.7x", delta: "↓ 0.4x", good: false },
  { label: "NPS", value: "46", delta: "↑ 5", good: true },
  { label: "Support SLA", value: "94%", delta: "↓ 2 pts", good: false },
  { label: "June MRR", value: "£412k", delta: "↑ £18k", good: true },
];

export const ROUNDUP_CONTRIBUTORS: RoundupContributor[] = [
  {
    name: "Tom Reeves",
    area: "Product & Eng",
    rag: "green",
    line: "Release 4.2 shipped on time; backlog up post-launch but triage in place.",
  },
  {
    name: "Priya Shah",
    area: "Sales",
    rag: "red",
    line: "Pipeline slipped 18%; two enterprise deals pushed to Q3. Northgate closed.",
  },
  {
    name: "Aisha Bello",
    area: "Support Ops",
    rag: "amber",
    line: "Ticket volume +240 after 4.2; SLA holding at 94% with a temporary rota.",
  },
  {
    name: "Liam Walsh",
    area: "Finance",
    rag: "green",
    line: "June tracking 4% above forecast; runway unchanged.",
  },
  {
    name: "Grace Lin",
    area: "People & Talent",
    rag: "green",
    line: "Two senior offers accepted; one open backfill in progress.",
  },
  {
    name: "Hugo Frost",
    area: "Data & Insights",
    rag: "amber",
    line: "Dashboard migration 70% done; one source flaky, low impact.",
  },
];

export const ROUNDUP_FULL = {
  title: "Week 25 · 15–21 June 2026",
  subtitle:
    "Prepared for the senior leadership team · 9 of 10 reports · connected data from 6 sheets",
  execSummary:
    "Delivery and finance had a strong week: Release 4.2 shipped on schedule and June revenue is tracking 4% above forecast. The headline win was closing Northgate Trust, the largest deal of the quarter. Two themes need leadership attention — sales pipeline coverage softened to 1.7x after two enterprise deals slipped to Q3, and the 4.2 launch drove a 240-ticket support backlog with SLA easing to 94%. None are red-line risks yet, but both compound if left unaddressed for another week.",
  risks: [
    "<strong>Pipeline coverage down to 1.7x (Sales).</strong> Halden Group and Vesper both pushed to Q3. Requested: an exec intro for the Halden renewal.",
    "<strong>Support backlog +240 tickets (Support Ops).</strong> Driven by 4.2; SLA at 94% and trending down. Mitigation: temporary triage rota in place this week.",
    "<strong>Data dashboard migration ~1 week behind (Data & Insights).</strong> One upstream source is intermittently failing; low business impact for now.",
  ],
  changed: [
    "Onboarding time fell to 3.1 days (from 4.4) following the guided-setup change.",
    "NPS rose to 46 (from 41).",
    "Pipeline coverage dropped from 2.1x to 1.7x.",
    "Support ticket volume up ~240 week-on-week.",
  ],
  highlights: [
    "Closed Northgate Trust — largest deal of the quarter (Sales).",
    "Release 4.2 shipped on schedule (Product & Engineering).",
    "Two senior offers accepted (People & Talent).",
    "June revenue tracking 4% above forecast (Finance).",
  ],
  appendixSource: "Source: 6 connected Google Sheets, pulled Sun 21 Jun 21:00.",
};

// Team
export const TEAM: User[] = [
  { name: "Maya Okafor", email: "maya.okafor@yourcompany.com", role: "Administrator", area: "Customer Success", submitted: true },
  { name: "Tom Reeves", email: "tom.reeves@yourcompany.com", role: "Contributor", area: "Product & Engineering", submitted: true },
  { name: "Priya Shah", email: "priya.shah@yourcompany.com", role: "Contributor", area: "Sales", submitted: true },
  { name: "Daniel Cole", email: "daniel.cole@yourcompany.com", role: "Contributor", area: "Marketing", submitted: false },
  { name: "Aisha Bello", email: "aisha.bello@yourcompany.com", role: "Contributor", area: "Support Ops", submitted: true },
  { name: "Liam Walsh", email: "liam.walsh@yourcompany.com", role: "Contributor", area: "Finance", submitted: true },
  { name: "Grace Lin", email: "grace.lin@yourcompany.com", role: "Administrator", area: "People & Talent", submitted: true },
  { name: "Noah Bennett", email: "noah.bennett@yourcompany.com", role: "Contributor", area: "Partnerships", submitted: false },
  { name: "Hugo Frost", email: "hugo.frost@yourcompany.com", role: "Contributor", area: "Data & Insights", submitted: true },
  { name: "Sofia Marin", email: "sofia.marin@yourcompany.com", role: "Recipient", area: "—", submitted: null },
];

export const TEAM_STATS = {
  contributors: 7,
  administrators: 2,
  recipientsOnly: 1,
};

// Reports manager
export const REPORT_TEMPLATES: ReportTemplate[] = [
  { title: "Customer Success", qCount: 8, cadence: "Weekly", assignees: ["Maya Okafor"], connected: true, edge: "#2E6B4E" },
  { title: "Product & Engineering", qCount: 7, cadence: "Weekly", assignees: ["Tom Reeves"], connected: true, edge: "#2D54EB" },
  { title: "Sales", qCount: 6, cadence: "Weekly", assignees: ["Priya Shah"], connected: true, edge: "#C0455B" },
  { title: "Marketing", qCount: 6, cadence: "Weekly", assignees: ["Daniel Cole"], connected: false, edge: "#B5762E" },
  { title: "Support Ops", qCount: 7, cadence: "Weekly", assignees: ["Aisha Bello"], connected: true, edge: "#1F8A8A" },
  { title: "Finance", qCount: 5, cadence: "Weekly", assignees: ["Liam Walsh"], connected: true, edge: "#7A4FB5" },
];

export const BUILDER_QUESTIONS: BuilderQuestion[] = [
  { text: "Overall health this week", type: "RAG" },
  { text: "Headlines — what should the senior team know?", type: "Long text" },
  { text: "Are we on track for the quarter?", type: "Single choice" },
  { text: "Customers onboarded this week", type: "Number" },
  { text: "Where do you need senior support?", type: "Multi choice" },
  { text: "Risks & blockers", type: "Long text" },
];

export const EDITOR_DATA_SOURCE = "docs.google.com/…/cs-metrics";

// Data sources — initial saved state (order matters for the table).
export const DATA_SOURCES: (DataSourceRow & { synced: string })[] = [
  { report: "Customer Success", url: "docs.google.com/spreadsheets/cs-metrics", synced: "2 min ago" },
  { report: "Product & Engineering", url: "docs.google.com/spreadsheets/eng-velocity", synced: "2 min ago" },
  { report: "Sales", url: "docs.google.com/spreadsheets/pipeline-q2", synced: "5 min ago" },
  { report: "Marketing", url: "", synced: "—" },
  { report: "Support Ops", url: "docs.google.com/spreadsheets/support-sla", synced: "2 min ago" },
  { report: "Finance", url: "docs.google.com/spreadsheets/finance-actuals", synced: "11 min ago" },
];

// Roundups list
export const THIS_WEEK_BANNER = {
  label: "THIS WEEK · WEEK 26",
  headline: "7 of 10 reports in — closes Sunday 20:00",
  sub: "Generate the Roundup once the window closes, or draft a preview now.",
};

export const ROUNDUPS_LIST: RoundupListItem[] = [
  { week: "Week 26", range: "22–28 Jun 2026", reports: "7 of 10", status: "Pending" },
  { week: "Week 25", range: "15–21 Jun 2026", reports: "9 of 10", status: "Sent" },
  { week: "Week 24", range: "8–14 Jun 2026", reports: "10 of 10", status: "Sent" },
  { week: "Week 23", range: "1–7 Jun 2026", reports: "8 of 10", status: "Sent" },
];

// Settings
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const TIMES = (() => {
  const t: string[] = [];
  for (let h = 0; h < 24; h++) {
    t.push(String(h).padStart(2, "0") + ":00");
    t.push(String(h).padStart(2, "0") + ":30");
  }
  return t;
})();

export const SCHEDULE_DEFAULTS = {
  closeDay: "Sunday",
  closeTime: "20:00",
  openDay: "Monday",
  openTime: "01:00",
};

export const REMINDER_TOGGLES: ReminderToggle[] = [
  { key: "friday", label: "Friday reminder", desc: "Email contributors who haven't started their report", on: true },
  { key: "sunday", label: "Sunday final call", desc: "Reminder at 17:00 on Sunday, 3 hours before close", on: true },
  { key: "ready", label: "Roundup ready", desc: "Notify recipients when the weekly summary is generated", on: false },
];

export const RECIPIENTS = ["Maya Okafor", "Sofia Marin", "James Pryor", "Elena Voss", "Grace Lin"];
