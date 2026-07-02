import { describe, expect, it } from "vitest";
import { compileRoundup, type CompileInput } from "./roundup";

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
