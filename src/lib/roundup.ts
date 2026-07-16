// Roundup content schema (stored as skimJson / fullJson) + a deterministic
// compiler that turns a week's submitted answers into that shape.
//
// The compiler infers structure from question TYPE (no per-question tagging):
//   rag         → the contributor's RAG dot + risk severity
//   short_text  → the contributor's one-line summary
//   long_text   → risks (if the question mentions risk/blocker) or highlights
//   number      → key metrics
// The AI generation step (later) can emit this exact shape as a drop-in upgrade.

export type Rag = "green" | "amber" | "red";
export type Severity = "High" | "Medium" | "Low";

export interface RiskItem {
  sev: Severity;
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
export interface ChartPoint {
  x: string; // period label from the sheet ("Jan 2026")
  y: number;
}
/** A full metric series pulled from a connected sheet (chart source data). */
export interface MetricSeries {
  label: string;
  unit: string; // leading prefix from the sheet values, e.g. "£" ("" if none)
  points: ChartPoint[];
}
/** A chart the AI chose to include. Points are copied verbatim from the
 *  sheet series — the AI only selects the series and writes title/note. */
export interface ChartItem {
  title: string;
  type: "line" | "bar";
  unit: string;
  points: ChartPoint[];
  note: string; // one-line takeaway ("" if none)
  showInSkim: boolean;
}
export interface TeamItem {
  name: string;
  area: string;
  rag: Rag | null;
  line: string;
}

export interface SkimJson {
  week: string; // "Week 26"
  range: string; // "22–28 Jun 2026"
  headline: string;
  reportsIn: string; // "3 of 5 reports in"
  generated: string; // "Generated Sun 21 Jun, 21:04"
  readTime: string; // "" when unknown
  risks: RiskItem[];
  changes: ChangeItem[];
  highlights: WinItem[];
  metrics: MetricItem[];
  byTeam: TeamItem[];
  charts?: ChartItem[]; // AI-selected trends (absent on older roundups)
}

export interface FullRisk {
  lead: string; // the owning area, shown bold
  text: string;
}

export interface FullJson {
  title: string;
  subtitle: string;
  execSummary: string;
  risks: FullRisk[];
  changed: string[];
  highlights: string[];
  byTeam: TeamItem[];
  metrics: MetricItem[];
  charts?: ChartItem[]; // AI-selected trends (absent on older roundups)
  appendixSource: string;
}

export interface RoundupContent {
  skim: SkimJson;
  full: FullJson;
}

export interface AnswerInput {
  type: string;
  text: string;
  unit?: string;
  value: unknown;
}
export interface ContributorReport {
  name: string;
  area: string;
  answers: AnswerInput[];
}
/** A child team's already-generated roundup, rolled up into the parent's
 *  (rollup_mode 'children'/'both'). Facts are AGGREGATED FROM THIS JSON —
 *  never re-derived by the model (the summarise-summaries invariant). */
export interface ChildRoundupInput {
  teamName: string;
  periodLabel: string; // the child roundup's own period, e.g. "Week 28"
  skim: SkimJson;
  execSummary?: string; // from the child's FullJson, for AI context
}
export interface CompileInput {
  weekNumber: string; // period heading — "Week 26" / "June 2026" / "Q2 2026"
  range: string; // period range — "22–28 Jun 2026" / "1–30 Jun 2026"
  reportsIn: number;
  totalExpected: number;
  generatedLabel: string; // "Generated Wed 1 Jul, 10:12"
  contributors: ContributorReport[];
  childRoundups?: ChildRoundupInput[]; // sub-team roundups to roll up
  sheetMetrics?: MetricItem[]; // pulled from connected Google Sheets
  sheetSeries?: MetricSeries[]; // full sheet history (chart source data)
}

const RISK_RE = /risk|blocker|concern|issue|problem/i;
const WIN_RE = /headline|highlight|win|proud|achiev|success|good news/i;

function strval(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v).trim();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function ragToSeverity(rag: Rag | null): Severity {
  return rag === "red" ? "High" : rag === "amber" ? "Medium" : "Low";
}

function contributorRag(c: ContributorReport): Rag | null {
  const a = c.answers.find((x) => x.type === "rag");
  const v = strval(a?.value);
  return v === "green" || v === "amber" || v === "red" ? v : null;
}

function summaryLine(c: ContributorReport): string {
  const short = c.answers.find(
    (x) => x.type === "short_text" && strval(x.value),
  );
  if (short) return strval(short.value);
  const long = c.answers.find((x) => x.type === "long_text" && strval(x.value));
  return long ? truncate(strval(long.value), 200) : "No summary provided.";
}

/** Worst RAG across a child roundup's per-team dots (red > amber > green);
 *  null when the child has no dots at all. */
export function worstRag(skim: SkimJson): Rag | null {
  let worst: Rag | null = null;
  const rank: Record<Rag, number> = { green: 0, amber: 1, red: 2 };
  for (const t of skim.byTeam ?? []) {
    if (t.rag && (worst === null || rank[t.rag] > rank[worst])) worst = t.rag;
  }
  return worst;
}

/**
 * D2: a parent consumes a child team's SENT roundups for the window, falling
 * back to the single latest draft only when nothing was sent. Rows are one
 * child team's roundups within the parent period (any period_starts).
 */
export function selectChildRows<
  T extends { periodStart: string; status: string },
>(rows: T[]): T[] {
  const sent = rows.filter((r) => r.status === "sent");
  if (sent.length > 0)
    return [...sent].sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
  const drafts = rows
    .filter((r) => r.status === "draft")
    .sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
  return drafts.length > 0 ? [drafts[drafts.length - 1]] : [];
}

export function compileRoundup(input: CompileInput): RoundupContent {
  const { contributors } = input;
  const children = input.childRoundups ?? [];

  let green = 0;
  let amber = 0;
  let red = 0;

  const byTeam: TeamItem[] = [];
  const skimRisks: RiskItem[] = [];
  const skimHighlights: WinItem[] = [];
  const metricsMap = new Map<string, MetricItem>();
  const fullRisks: FullRisk[] = [];
  const fullHighlights: string[] = [];

  for (const c of contributors) {
    const rag = contributorRag(c);
    if (rag === "green") green++;
    else if (rag === "amber") amber++;
    else if (rag === "red") red++;

    byTeam.push({ name: c.name, area: c.area, rag, line: summaryLine(c) });

    for (const a of c.answers) {
      const v = strval(a.value);
      if (!v) continue;

      if (a.type === "long_text" && RISK_RE.test(a.text)) {
        skimRisks.push({
          sev: ragToSeverity(rag),
          text: v,
          who: `${c.area} · ${c.name}`,
        });
        fullRisks.push({ lead: c.area, text: v });
      } else if (a.type === "long_text" && WIN_RE.test(a.text)) {
        skimHighlights.push({ text: v, who: c.area });
        fullHighlights.push(`${v} (${c.area})`);
      }

      if (a.type === "number") {
        const value = a.unit ? `${v} ${a.unit}` : v;
        // key by label to avoid dupes; last write wins
        metricsMap.set(`${c.area}:${a.text}`, {
          label: a.text,
          value,
          delta: "",
          good: true,
        });
      }
    }
  }

  // Roll up child-team roundups (summarise-summaries). Facts aggregate from
  // the children's stored JSON: worst RAG dot per child, their risks and
  // highlights as filed, their metric cards. Child CHARTS are deliberately
  // not rolled up — the parent's own connected sheets supply its charts.
  for (const child of children) {
    const rag = worstRag(child.skim);
    if (rag === "green") green++;
    else if (rag === "amber") amber++;
    else if (rag === "red") red++;

    byTeam.push({
      name: child.teamName,
      area: child.periodLabel,
      rag,
      line: child.skim.headline || "No summary available.",
    });

    for (const r of child.skim.risks ?? []) {
      skimRisks.push(r);
      fullRisks.push({ lead: child.teamName, text: r.text });
    }
    for (const h of child.skim.highlights ?? []) {
      skimHighlights.push({ text: h.text, who: h.who || child.teamName });
      fullHighlights.push(`${h.text} (${h.who || child.teamName})`);
    }
    for (const m of child.skim.metrics ?? []) {
      // Team-prefix on label collision so two teams' "Revenue" both survive.
      const key = `${child.teamName}:${m.label}`;
      const collides = [...metricsMap.values()].some(
        (x) => x.label === m.label,
      );
      metricsMap.set(
        key,
        collides ? { ...m, label: `${child.teamName}: ${m.label}` } : m,
      );
    }
  }

  // Connected-sheet metrics first, then answer/child metrics.
  const sheetMetrics = input.sheetMetrics ?? [];
  const metrics = [...sheetMetrics, ...metricsMap.values()];

  // Severity order: High → Medium → Low
  const sevRank: Record<Severity, number> = { High: 0, Medium: 1, Low: 2 };
  skimRisks.sort((a, b) => sevRank[a.sev] - sevRank[b.sev]);

  const ragParts: string[] = [];
  if (green) ragParts.push(`${green} on track`);
  if (amber) ragParts.push(`${amber} watching closely`);
  if (red) ragParts.push(`${red} needing attention`);

  const headline =
    ragParts.length > 0
      ? capitalise(joinList(ragParts)) + " this week."
      : `${input.reportsIn} of ${input.totalExpected} reports are in for ${input.weekNumber}.`;

  const reportsInLabel =
    `${input.reportsIn} of ${input.totalExpected} reports in` +
    (children.length > 0
      ? ` · ${children.length} team roundup${children.length === 1 ? "" : "s"}`
      : "");

  const skim: SkimJson = {
    week: input.weekNumber,
    range: input.range,
    headline,
    reportsIn: reportsInLabel,
    generated: input.generatedLabel,
    readTime: "",
    risks: skimRisks,
    changes: [], // deterministic compile can't infer week-on-week change yet
    highlights: skimHighlights,
    metrics,
    byTeam,
  };

  const execParts = [
    `${input.reportsIn} of ${input.totalExpected} reports are in for ${input.weekNumber}.`,
  ];
  if (ragParts.length > 0) {
    execParts.push(`${capitalise(joinList(ragParts))}.`);
  }
  if (skimRisks.length > 0) {
    execParts.push(
      `${skimRisks.length} risk${skimRisks.length === 1 ? "" : "s"} flagged for attention.`,
    );
  }

  const full: FullJson = {
    title: `${input.weekNumber} · ${input.range}`,
    subtitle: `Prepared for the senior leadership team · ${reportsInLabel}`,
    execSummary: execParts.join(" "),
    risks: fullRisks,
    changed: [],
    highlights: fullHighlights,
    byTeam,
    metrics,
    appendixSource:
      sheetMetrics.length > 0
        ? "Figures pulled from connected Google Sheets."
        : metrics.length > 0
          ? "Figures taken from this week's submitted reports."
          : "",
  };

  return { skim, full };
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
