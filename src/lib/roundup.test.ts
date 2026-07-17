import { describe, expect, it } from "vitest";
import {
  compileRoundup,
  selectChildRows,
  worstRag,
  type CompileInput,
} from "./roundup";

function input(partial: Partial<CompileInput> = {}): CompileInput {
  return {
    weekNumber: "Week 27",
    range: "29 Jun–5 Jul 2026",
    reportsIn: 2,
    totalExpected: 3,
    generatedLabel: "Generated Wed 1 Jul, 10:12",
    contributors: [],
    ...partial,
  };
}

const priya = {
  name: "Priya Shah",
  area: "Sales",
  answers: [
    { type: "rag", text: "Overall health", value: "red" },
    { type: "short_text", text: "One line", value: "Big win, pipeline soft." },
    {
      type: "long_text",
      text: "Risks & blockers",
      value: "Two deals slipped to Q3.",
    },
    { type: "number", text: "Customers onboarded", unit: "customers", value: 7 },
  ],
};
const tom = {
  name: "Tom Reeves",
  area: "Product & Eng",
  answers: [
    { type: "rag", text: "Overall health", value: "green" },
    { type: "long_text", text: "Highlights", value: "Shipped 4.2 on time." },
  ],
};

describe("compileRoundup", () => {
  it("summarises RAG counts in the headline", () => {
    const { skim } = compileRoundup(input({ contributors: [priya, tom] }));
    expect(skim.headline).toBe(
      "1 on track and 1 needing attention this week.",
    );
  });

  it("routes a risk long-text to a risk with severity from the RAG", () => {
    const { skim, full } = compileRoundup(input({ contributors: [priya, tom] }));
    expect(skim.risks).toHaveLength(1);
    expect(skim.risks[0]).toMatchObject({
      sev: "High",
      text: "Two deals slipped to Q3.",
      who: "Sales · Priya Shah",
    });
    expect(full.risks[0]).toEqual({
      lead: "Sales",
      text: "Two deals slipped to Q3.",
    });
  });

  it("routes highlights, numbers and the one-liner", () => {
    const { skim } = compileRoundup(input({ contributors: [priya, tom] }));
    expect(skim.highlights).toEqual([
      { text: "Shipped 4.2 on time.", who: "Product & Eng" },
    ]);
    expect(skim.metrics).toEqual([
      { label: "Customers onboarded", value: "7 customers", delta: "", good: true },
    ]);
    expect(skim.byTeam[0]).toMatchObject({
      name: "Priya Shah",
      area: "Sales",
      rag: "red",
      line: "Big win, pipeline soft.",
    });
    expect(skim.byTeam[1].rag).toBe("green");
  });

  it("orders risks by severity (High first)", () => {
    const amberRisk = {
      name: "Aisha",
      area: "Support",
      answers: [
        { type: "rag", text: "Health", value: "amber" },
        { type: "long_text", text: "Risk", value: "SLA easing." },
      ],
    };
    const { skim } = compileRoundup(
      input({ contributors: [amberRisk, priya] }),
    );
    expect(skim.risks.map((r) => r.sev)).toEqual(["High", "Medium"]);
  });

  it("handles a contributor with no RAG answer", () => {
    const noRag = {
      name: "Sam",
      area: "Ops",
      answers: [{ type: "long_text", text: "Risk", value: "A blocker." }],
    };
    const { skim } = compileRoundup(input({ contributors: [noRag] }));
    expect(skim.byTeam[0].rag).toBeNull();
    expect(skim.risks[0].sev).toBe("Low");
  });

  it("produces a sensible empty roundup", () => {
    const { skim, full } = compileRoundup(
      input({ contributors: [], reportsIn: 0 }),
    );
    expect(skim.headline).toBe("0 of 3 reports are in for Week 27.");
    expect(skim.risks).toEqual([]);
    expect(skim.byTeam).toEqual([]);
    expect(full.title).toBe("Week 27 · 29 Jun–5 Jul 2026");
    expect(full.execSummary).toContain("0 of 3 reports");
  });

  it("falls back to a long-text summary when there's no short-text", () => {
    const c = {
      name: "Lee",
      area: "Data",
      answers: [
        { type: "rag", text: "Health", value: "green" },
        { type: "long_text", text: "Notes", value: "Migration 70% done." },
      ],
    };
    const { skim } = compileRoundup(input({ contributors: [c] }));
    expect(skim.byTeam[0].line).toBe("Migration 70% done.");
  });
});

// ── Roll-up: child-team roundups (summarise-summaries) ──

function childSkim(partial: Partial<import("./roundup").SkimJson> = {}) {
  return {
    week: "Week 27",
    range: "29 Jun–5 Jul 2026",
    headline: "Steady week for the squad.",
    reportsIn: "3 of 3 reports in",
    generated: "Generated Sun 5 Jul, 20:04",
    readTime: "",
    risks: [],
    changes: [],
    highlights: [],
    metrics: [],
    byTeam: [],
    ...partial,
  };
}

describe("compileRoundup child roundups", () => {
  it("derives each child's RAG from its worst per-team dot and counts it in the headline", () => {
    const out = compileRoundup(
      input({
        contributors: [tom], // green
        childRoundups: [
          {
            teamName: "Design",
            periodLabel: "Week 27",
            skim: childSkim({
              byTeam: [
                { name: "A", area: "UX", rag: "green", line: "" },
                { name: "B", area: "UI", rag: "red", line: "" },
              ],
            }),
          },
        ],
      }),
    );
    expect(out.skim.headline).toBe(
      "1 on track and 1 needing attention this week.",
    );
    const design = out.skim.byTeam.find((t) => t.name === "Design");
    expect(design?.rag).toBe("red");
    expect(design?.area).toBe("Week 27");
    expect(design?.line).toBe("Steady week for the squad.");
  });

  it("carries child risks and highlights through verbatim", () => {
    const out = compileRoundup(
      input({
        childRoundups: [
          {
            teamName: "Design",
            periodLabel: "Week 27",
            skim: childSkim({
              risks: [
                { sev: "High", text: "Hiring freeze bites.", who: "UX · A" },
              ],
              highlights: [{ text: "New onboarding shipped.", who: "UI" }],
            }),
          },
        ],
      }),
    );
    expect(out.skim.risks).toEqual([
      { sev: "High", text: "Hiring freeze bites.", who: "UX · A" },
    ]);
    expect(out.full.risks).toEqual([
      { lead: "Design", text: "Hiring freeze bites." },
    ]);
    expect(out.skim.highlights).toEqual([
      { text: "New onboarding shipped.", who: "UI" },
    ]);
  });

  it("prefixes child metric labels only on collision", () => {
    const out = compileRoundup(
      input({
        childRoundups: [
          {
            teamName: "Design",
            periodLabel: "Week 27",
            skim: childSkim({
              metrics: [{ label: "Revenue", value: "£10k", delta: "", good: true }],
            }),
          },
          {
            teamName: "Sales",
            periodLabel: "Week 27",
            skim: childSkim({
              metrics: [
                { label: "Revenue", value: "£20k", delta: "", good: true },
                { label: "Pipeline", value: "£90k", delta: "", good: true },
              ],
            }),
          },
        ],
      }),
    );
    const labels = out.skim.metrics.map((m) => m.label);
    expect(labels).toContain("Revenue"); // first team keeps the plain label
    expect(labels).toContain("Sales: Revenue"); // collision gets the prefix
    expect(labels).toContain("Pipeline"); // no collision, no prefix
  });

  it("collapses several roundups from ONE child team to a single latest representative", () => {
    // A monthly parent rolling up a weekly child sees 3 of its roundups.
    const out = compileRoundup(
      input({
        childRoundups: [
          {
            teamName: "Design",
            periodLabel: "Week 23",
            skim: childSkim({
              headline: "Rough start.",
              byTeam: [{ name: "A", area: "", rag: "red", line: "" }],
              risks: [{ sev: "High", text: "Understaffed.", who: "A" }],
            }),
          },
          {
            teamName: "Design",
            periodLabel: "Week 24",
            skim: childSkim({
              headline: "Steadying.",
              byTeam: [{ name: "A", area: "", rag: "amber", line: "" }],
              risks: [{ sev: "Medium", text: "Understaffed.", who: "A" }],
            }),
          },
          {
            teamName: "Design",
            periodLabel: "Week 25",
            skim: childSkim({
              headline: "Back on track.",
              byTeam: [{ name: "A", area: "", rag: "green", line: "" }],
              highlights: [{ text: "Hired two designers.", who: "A" }],
            }),
          },
        ],
      }),
    );
    // ONE byTeam row for Design (the latest week), counted once in the tally.
    const designRows = out.skim.byTeam.filter((t) => t.name === "Design");
    expect(designRows).toHaveLength(1);
    expect(designRows[0].rag).toBe("green"); // latest
    expect(designRows[0].line).toBe("Back on track.");
    expect(out.skim.headline).toBe("1 on track this week."); // not "3 …"
    // Only the latest week's risks/highlights, no cross-week duplication.
    expect(out.skim.risks).toHaveLength(0);
    expect(out.skim.highlights).toEqual([
      { text: "Hired two designers.", who: "A" },
    ]);
    expect(out.skim.reportsIn).toContain("1 team roundup");
  });

  it("does NOT roll child charts up and notes team roundups in the reports-in label", () => {
    const out = compileRoundup(
      input({
        childRoundups: [
          {
            teamName: "Design",
            periodLabel: "Week 27",
            skim: childSkim({
              charts: [
                {
                  title: "T",
                  type: "line",
                  unit: "",
                  points: [{ x: "Jan", y: 1 }],
                  note: "",
                  showInSkim: true,
                },
              ],
            }),
          },
        ],
      }),
    );
    expect(out.skim.charts ?? []).toEqual([]);
    expect(out.skim.reportsIn).toBe("2 of 3 reports in · 1 team roundup");
  });
});

describe("worstRag / selectChildRows", () => {
  it("worstRag ranks red > amber > green and handles empties", () => {
    expect(
      worstRag(
        childSkim({
          byTeam: [
            { name: "A", area: "", rag: "amber", line: "" },
            { name: "B", area: "", rag: "green", line: "" },
          ],
        }),
      ),
    ).toBe("amber");
    expect(worstRag(childSkim())).toBe(null);
  });

  it("prefers ALL sent rows in the window, ordered by period", () => {
    const rows = [
      { periodStart: "2026-07-13", status: "sent" },
      { periodStart: "2026-07-06", status: "sent" },
      { periodStart: "2026-07-20", status: "draft" },
    ];
    expect(selectChildRows(rows).map((r) => r.periodStart)).toEqual([
      "2026-07-06",
      "2026-07-13",
    ]);
  });

  it("falls back to the single LATEST draft when nothing is sent", () => {
    const rows = [
      { periodStart: "2026-07-06", status: "draft" },
      { periodStart: "2026-07-13", status: "draft" },
      { periodStart: "2026-07-20", status: "pending" },
    ];
    expect(selectChildRows(rows).map((r) => r.periodStart)).toEqual([
      "2026-07-13",
    ]);
  });

  it("returns nothing when there are no sent or draft rows", () => {
    expect(selectChildRows([{ periodStart: "2026-07-06", status: "pending" }])).toEqual([]);
  });
});
