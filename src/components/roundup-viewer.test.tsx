import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RoundupViewer } from "./roundup-viewer";
import type { ChartItem, FullJson, SkimJson } from "@/lib/roundup";

const CHART: ChartItem = {
  title: "MRR trend",
  type: "line",
  unit: "£",
  points: [
    { x: "Nov 2025", y: 350000 },
    { x: "Dec 2025", y: 375641.58 },
    { x: "Jan 2026", y: 407398.82 },
  ],
  note: "Growth accelerating into the new year.",
  showInSkim: true,
};

const SKIM: SkimJson = {
  week: "Week 27",
  range: "29 Jun–5 Jul 2026",
  headline: "All teams on track.",
  reportsIn: "2 of 2 reports in",
  generated: "Generated Fri 3 Jul, 09:00",
  readTime: "",
  risks: [],
  changes: [],
  highlights: [],
  metrics: [],
  byTeam: [],
  charts: [CHART],
};

const FULL: FullJson = {
  title: "Week 27 · 29 Jun–5 Jul 2026",
  subtitle: "Prepared for the senior leadership team",
  execSummary: "Steady week.",
  risks: [],
  changed: [],
  highlights: [],
  byTeam: [],
  metrics: [],
  charts: [CHART, { ...CHART, type: "bar", title: "NPS", showInSkim: false }],
  appendixSource: "",
};

describe("RoundupViewer charts", () => {
  it("renders the chart card with an SVG line chart in skim mode", () => {
    const html = renderToStaticMarkup(<RoundupViewer skim={SKIM} full={FULL} />);
    // The dashboard restyle drops the "Trends" label — the chart card sits
    // directly in the chart/by-team grid.
    expect(html).toContain("MRR trend");
    expect(html).toContain("<polyline");
    expect(html).toContain("latest £407,399"); // aria-label carries the value
    expect(html).toContain("£407,399"); // latest value, unit + compact format // first x label
    expect(html).toContain("Growth accelerating into the new year.");
    // No NaN coordinates anywhere in the SVG.
    expect(html).not.toContain("NaN");
  });

  it("survives roundups stored before charts existed (no charts key)", () => {
    const html = renderToStaticMarkup(
      <RoundupViewer
        skim={{ ...SKIM, charts: undefined }}
        full={{ ...FULL, charts: undefined }}
      />,
    );
    expect(html).not.toContain("Trends");
  });
});
