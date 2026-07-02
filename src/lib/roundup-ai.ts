// AI generation step for the Roundup.
//
// This is a drop-in upgrade over the deterministic compileRoundup(): same
// CompileInput → RoundupContent contract, so the generate route, storage, and
// viewer are all unchanged.
//
// Design — code owns the facts, Claude writes the prose:
//   • compileRoundup() first computes the authoritative structured fields
//     (metrics, per-team RAG dots, report counts, dates). Claude never touches
//     these, so it can't invent a number or a status.
//   • Claude receives the week's raw contributor answers + connected-sheet
//     metrics + prior weeks, and returns ONLY the narrative: the headline,
//     exec summary, risk/highlight phrasing, per-team one-liners, and the
//     week-over-week "changes" the deterministic path can't infer.
//   • The two are merged: deterministic skeleton, AI prose overlaid.
//
// If ANTHROPIC_API_KEY is unset, or the call errors / times out / is refused,
// we transparently return the deterministic compileRoundup() output.

import Anthropic from "@anthropic-ai/sdk";
import {
  compileRoundup,
  type ChangeItem,
  type CompileInput,
  type FullRisk,
  type MetricItem,
  type RiskItem,
  type RoundupContent,
  type Severity,
  type WinItem,
} from "./roundup";

/** A prior week's context, for week-over-week narrative. */
export interface PriorWeek {
  week: string; // "Week 25"
  headline: string;
  metrics: MetricItem[];
}

// The narrative-only shape Claude returns. Facts (metrics, RAG, counts) are
// deliberately absent — those come from compileRoundup().
interface AiNarrative {
  headline: string;
  execSummary: string;
  risks: { area: string; sev: Severity; text: string }[];
  highlights: { area: string; text: string }[];
  changes: { dir: "up" | "down"; text: string }[];
  teamLines: { name: string; line: string }[];
}

const NARRATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description:
        "One punchy sentence summarising the week for senior leadership.",
    },
    execSummary: {
      type: "string",
      description:
        "2–4 sentences: the state of play, what changed, and where attention is needed.",
    },
    risks: {
      type: "array",
      description: "Risks and blockers raised this week, most severe first.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: {
            type: "string",
            description: "The team/area that owns this risk.",
          },
          sev: { type: "string", enum: ["High", "Medium", "Low"] },
          text: {
            type: "string",
            description: "A concise, leadership-ready phrasing of the risk.",
          },
        },
        required: ["area", "sev", "text"],
      },
    },
    highlights: {
      type: "array",
      description: "Wins and good news worth surfacing.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          text: { type: "string" },
        },
        required: ["area", "text"],
      },
    },
    changes: {
      type: "array",
      description:
        "Notable week-over-week movements vs prior weeks. Empty if there is no prior context to compare against.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          dir: { type: "string", enum: ["up", "down"] },
          text: {
            type: "string",
            description: "What moved and in which direction.",
          },
        },
        required: ["dir", "text"],
      },
    },
    teamLines: {
      type: "array",
      description:
        "One tightened one-liner per contributor, keyed by their exact name.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          line: { type: "string" },
        },
        required: ["name", "line"],
      },
    },
  },
  required: [
    "headline",
    "execSummary",
    "risks",
    "highlights",
    "changes",
    "teamLines",
  ],
} as const;

function buildPrompt(input: CompileInput, priorWeeks: PriorWeek[]): string {
  const lines: string[] = [];
  lines.push(
    `You are compiling the weekly "Roundup" — a summary of team-lead updates for the senior leadership team of an education-technology company.`,
    ``,
    `WEEK: ${input.weekNumber} (${input.range})`,
    `REPORTS IN: ${input.reportsIn} of ${input.totalExpected}`,
    ``,
    `CONTRIBUTOR REPORTS:`,
  );

  for (const c of input.contributors) {
    const rag = c.answers.find((a) => a.type === "rag");
    const ragVal = rag ? String(rag.value ?? "").trim() : "";
    lines.push(
      `- ${c.name} (${c.area})${ragVal ? ` — status: ${ragVal}` : ""}`,
    );
    for (const a of c.answers) {
      if (a.type === "rag") continue;
      const v = Array.isArray(a.value)
        ? a.value.join(", ")
        : String(a.value ?? "").trim();
      if (!v) continue;
      lines.push(`    • ${a.text}: ${v}${a.unit ? ` ${a.unit}` : ""}`);
    }
  }

  if (input.sheetMetrics && input.sheetMetrics.length > 0) {
    lines.push(``, `CONNECTED-SHEET METRICS (this week):`);
    for (const m of input.sheetMetrics) {
      lines.push(`- ${m.label}: ${m.value}${m.delta ? ` (${m.delta})` : ""}`);
    }
  }

  if (priorWeeks.length > 0) {
    lines.push(``, `PRIOR WEEKS (for week-over-week comparison):`);
    for (const p of priorWeeks) {
      lines.push(`- ${p.week}: ${p.headline}`);
      for (const m of p.metrics.slice(0, 8)) {
        lines.push(`    • ${m.label}: ${m.value}`);
      }
    }
  }

  lines.push(
    ``,
    `Write the narrative for this week's Roundup. Guidance:`,
    `- Ground every statement in the reports and metrics above — do not invent facts, numbers, or names.`,
    `- Use each contributor's exact name in teamLines.`,
    `- For "changes", only compare against the prior weeks shown; return an empty array if there is nothing meaningful to compare.`,
    `- Attribute each risk and highlight to the correct area.`,
    `- Write for busy executives: direct, specific, no filler or hedging.`,
  );

  return lines.join("\n");
}

/**
 * Generate the Roundup with Claude, falling back to the deterministic compiler
 * on missing key / error / timeout / refusal. Never throws.
 */
export async function generateRoundupAI(
  input: CompileInput,
  priorWeeks: PriorWeek[] = [],
): Promise<RoundupContent> {
  const deterministic = compileRoundup(input);
  if (!process.env.ANTHROPIC_API_KEY) return deterministic;

  try {
    const client = new Anthropic();
    const response = await client.messages.create(
      {
        model: "claude-opus-4-8",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        output_config: {
          format: { type: "json_schema", schema: NARRATIVE_SCHEMA },
        },
        messages: [{ role: "user", content: buildPrompt(input, priorWeeks) }],
      },
      { timeout: 55_000 },
    );

    if (response.stop_reason === "refusal") return deterministic;

    const jsonBlock = response.content.find((b) => b.type === "text");
    if (!jsonBlock || jsonBlock.type !== "text") return deterministic;

    const ai = JSON.parse(jsonBlock.text) as AiNarrative;
    return mergeNarrative(input, deterministic, ai);
  } catch {
    return deterministic;
  }
}

/** Overlay Claude's prose onto the deterministic skeleton (facts win). */
function mergeNarrative(
  input: CompileInput,
  base: RoundupContent,
  ai: AiNarrative,
): RoundupContent {
  // Map an area to a contributor "who" attribution ("Area · Name").
  const whoForArea = (area: string): string => {
    const c = input.contributors.find((x) => x.area === area);
    return c ? `${c.area} · ${c.name}` : area;
  };

  const risks: RiskItem[] = ai.risks.map((r) => ({
    sev: r.sev,
    text: r.text,
    who: whoForArea(r.area),
  }));
  const sevRank: Record<Severity, number> = { High: 0, Medium: 1, Low: 2 };
  risks.sort((a, b) => sevRank[a.sev] - sevRank[b.sev]);

  const highlights: WinItem[] = ai.highlights.map((h) => ({
    text: h.text,
    who: h.area,
  }));

  const changes: ChangeItem[] = ai.changes.map((c) => ({
    dir: c.dir,
    text: c.text,
  }));

  // Per-team one-liners: AI phrasing keyed by name, RAG dot from code.
  const lineByName = new Map(ai.teamLines.map((t) => [t.name, t.line]));
  const byTeam = base.skim.byTeam.map((t) => ({
    ...t,
    line: lineByName.get(t.name) ?? t.line,
  }));

  const fullRisks: FullRisk[] = ai.risks.map((r) => ({
    lead: r.area,
    text: r.text,
  }));
  const fullHighlights = ai.highlights.map((h) => `${h.text} (${h.area})`);
  const changed = changes.map(
    (c) => `${c.dir === "up" ? "↑" : "↓"} ${c.text}`,
  );

  return {
    skim: {
      ...base.skim,
      headline: ai.headline || base.skim.headline,
      risks,
      changes,
      highlights,
      byTeam,
    },
    full: {
      ...base.full,
      execSummary: ai.execSummary || base.full.execSummary,
      risks: fullRisks,
      changed,
      highlights: fullHighlights,
      byTeam,
    },
  };
}
