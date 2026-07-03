import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateRoundupAI } from "./roundup-ai";
import { compileRoundup, type CompileInput } from "./roundup";

const INPUT: CompileInput = {
  weekNumber: "Week 26",
  range: "22–28 Jun 2026",
  reportsIn: 2,
  totalExpected: 3,
  generatedLabel: "Generated Wed 1 Jul, 10:12",
  contributors: [
    {
      name: "Ada Lovelace",
      area: "Platform",
      answers: [
        { type: "rag", text: "Status", value: "green" },
        { type: "short_text", text: "Summary", value: "Shipped the new sync." },
        {
          type: "long_text",
          text: "Any risks or blockers?",
          value: "Auth migration is behind.",
        },
      ],
    },
  ],
};

describe("generateRoundupAI", () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevKey;
  });

  it("falls back to the deterministic compiler when no API key is set", async () => {
    const result = await generateRoundupAI(INPUT);
    expect(result).toEqual(compileRoundup(INPUT));
  });

  it("never throws and returns valid content without a key", async () => {
    const result = await generateRoundupAI(INPUT, [
      { week: "Week 25", headline: "Steady week.", metrics: [] },
    ]);
    expect(result.skim.week).toBe("Week 26");
    expect(result.full.title).toContain("Week 26");
    expect(Array.isArray(result.skim.byTeam)).toBe(true);
  });
});

describe("mergeNarrative charts", async () => {
  const { mergeNarrative } = await import("./roundup-ai");

  const SERIES_INPUT: CompileInput = {
    ...INPUT,
    sheetSeries: [
      {
        label: "MRR",
        unit: "£",
        points: [
          { x: "Nov", y: 350000 },
          { x: "Dec", y: 375641 },
          { x: "Jan", y: 407398 },
        ],
      },
      {
        label: "NPS",
        unit: "",
        points: [
          { x: "Nov", y: 41 },
          { x: "Dec", y: 44 },
          { x: "Jan", y: 46 },
        ],
      },
    ],
  };

  const NARRATIVE = {
    headline: "h",
    execSummary: "e",
    risks: [],
    highlights: [],
    changes: [],
    teamLines: [],
    charts: [] as {
      metric: string;
      title: string;
      type: "line" | "bar";
      note: string;
      showInSkim: boolean;
    }[],
  };

  it("copies points verbatim from the sheet series, never from the AI", () => {
    const out = mergeNarrative(SERIES_INPUT, compileRoundup(SERIES_INPUT), {
      ...NARRATIVE,
      charts: [
        { metric: "MRR", title: "MRR trend", type: "line", note: "Up.", showInSkim: true },
      ],
    });
    expect(out.full.charts).toHaveLength(1);
    expect(out.full.charts![0].points).toEqual(SERIES_INPUT.sheetSeries![0].points);
    expect(out.full.charts![0].unit).toBe("£");
    expect(out.skim.charts).toHaveLength(1); // showInSkim surfaces it in skim
  });

  it("drops charts referencing series that don't exist", () => {
    const out = mergeNarrative(SERIES_INPUT, compileRoundup(SERIES_INPUT), {
      ...NARRATIVE,
      charts: [
        { metric: "Invented metric", title: "x", type: "line", note: "", showInSkim: false },
        { metric: "NPS", title: "NPS", type: "bar", note: "", showInSkim: false },
      ],
    });
    expect(out.full.charts!.map((c) => c.title)).toEqual(["NPS"]);
    expect(out.skim.charts).toHaveLength(0);
  });

  it("allows at most one skim chart", () => {
    const out = mergeNarrative(SERIES_INPUT, compileRoundup(SERIES_INPUT), {
      ...NARRATIVE,
      charts: [
        { metric: "MRR", title: "a", type: "line", note: "", showInSkim: true },
        { metric: "NPS", title: "b", type: "line", note: "", showInSkim: true },
      ],
    });
    expect(out.skim.charts!.map((c) => c.title)).toEqual(["a"]);
    expect(out.full.charts).toHaveLength(2);
  });
});
