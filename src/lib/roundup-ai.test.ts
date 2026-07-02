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
