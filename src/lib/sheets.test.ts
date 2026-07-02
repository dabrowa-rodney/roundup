import { describe, expect, it } from "vitest";
import { extractMetrics, parseCsv, sheetCsvUrl } from "./sheets";

describe("sheetCsvUrl", () => {
  it("builds the CSV export URL from a share link", () => {
    expect(
      sheetCsvUrl(
        "https://docs.google.com/spreadsheets/d/1UfaQU_htx-Rl/edit?usp=sharing",
      ),
    ).toBe(
      "https://docs.google.com/spreadsheets/d/1UfaQU_htx-Rl/export?format=csv",
    );
  });
  it("includes gid when present", () => {
    expect(
      sheetCsvUrl("https://docs.google.com/spreadsheets/d/ABC/edit#gid=42"),
    ).toBe("https://docs.google.com/spreadsheets/d/ABC/export?format=csv&gid=42");
  });
  it("returns null for non-sheet URLs", () => {
    expect(sheetCsvUrl("https://example.com/x")).toBeNull();
  });
});

describe("parseCsv", () => {
  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('a,"1,234",b\nc,d,e');
    expect(rows).toEqual([
      ["a", "1,234", "b"],
      ["c", "d", "e"],
    ]);
  });
});

describe("extractMetrics", () => {
  it("takes the latest value + currency delta per column", () => {
    const csv = [
      "Month-Year,Datasync monthly revenue (MRR)",
      "Jan 2024,",
      'Dec 2025,"£375,641.58"',
      'Jan 2026,"£407,398.82"',
    ].join("\n");
    const metrics = extractMetrics(parseCsv(csv));
    expect(metrics).toEqual([
      {
        label: "Datasync monthly revenue (MRR)",
        value: "£407,398.82",
        delta: "↑ £31,757.24",
        good: true,
      },
    ]);
  });

  it("marks a decline as not-good with a down arrow", () => {
    const csv = "Week,Pipeline\nW1,2.1\nW2,1.7";
    const [m] = extractMetrics(parseCsv(csv));
    expect(m).toMatchObject({ value: "1.7", delta: "↓ 0.4", good: false });
  });

  it("handles multiple metric columns and blanks", () => {
    const csv = "Period,NPS,Tickets\nJan,41,\nFeb,46,240";
    const metrics = extractMetrics(parseCsv(csv));
    expect(metrics.map((m) => m.label)).toEqual(["NPS", "Tickets"]);
    expect(metrics[0]).toMatchObject({ value: "46", delta: "↑ 5" });
    // Tickets has only one value → no delta
    expect(metrics[1]).toMatchObject({ value: "240", delta: "" });
  });

  it("returns nothing for an empty sheet", () => {
    expect(extractMetrics(parseCsv(""))).toEqual([]);
  });
});
