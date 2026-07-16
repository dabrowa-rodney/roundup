import { afterEach, describe, expect, it, vi } from "vitest";
import {
  greeting,
  isoWeek,
  mondayISO,
  mondayOf,
  monthStartISO,
  parseISODate,
  periodForCadence,
  periodLabel,
  periodRange,
  periodStartISO,
  quarterStartISO,
  relativeTime,
  toISODate,
  weekLabel,
  weekNumberLabel,
  weekRange,
} from "./dates";

const utc = (s: string) => new Date(s);

describe("mondayOf", () => {
  it("returns the Monday for a mid-week day", () => {
    expect(toISODate(mondayOf(utc("2026-07-01T21:00:00Z")))).toBe("2026-06-29");
  });
  it("treats Sunday as the end of the same week", () => {
    expect(toISODate(mondayOf(utc("2026-07-05T10:00:00Z")))).toBe("2026-06-29");
  });
  it("is idempotent on a Monday", () => {
    expect(toISODate(mondayOf(utc("2026-06-29T00:00:00Z")))).toBe("2026-06-29");
  });
});

describe("mondayISO / parseISODate round-trip", () => {
  it("produces a stable YYYY-MM-DD string", () => {
    expect(mondayISO(utc("2026-07-01T21:00:00Z"))).toBe("2026-06-29");
  });
  it("parses back to UTC midnight", () => {
    expect(parseISODate("2026-06-29").toISOString()).toBe(
      "2026-06-29T00:00:00.000Z",
    );
  });
});

describe("isoWeek", () => {
  it("week 1 contains the first Thursday", () => {
    expect(isoWeek(utc("2026-01-01T00:00:00Z"))).toBe(1);
  });
  it("computes a mid-year week", () => {
    expect(isoWeek(utc("2026-06-29T00:00:00Z"))).toBe(27);
  });
  it("increments week-over-week", () => {
    const a = isoWeek(parseISODate("2026-06-29"));
    const b = isoWeek(parseISODate("2026-07-06"));
    expect(b).toBe(a + 1);
  });
});

describe("weekRange / weekLabel", () => {
  it("formats a month-spanning range", () => {
    expect(weekRange(parseISODate("2026-06-29"))).toBe("29 Jun–5 Jul 2026");
  });
  it("formats a same-month range", () => {
    expect(weekRange(parseISODate("2026-06-01"))).toBe("1–7 Jun 2026");
  });
  it("builds the full label", () => {
    expect(weekLabel(parseISODate("2026-06-29"))).toBe(
      "Week 27 · 29 Jun–5 Jul 2026",
    );
    expect(weekNumberLabel(parseISODate("2026-06-29"))).toBe("Week 27");
  });
});

describe("relativeTime", () => {
  afterEach(() => vi.useRealTimers());
  const setNow = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };
  it("handles empty input", () => {
    expect(relativeTime(null)).toBe("");
    expect(relativeTime(undefined)).toBe("");
  });
  it("buckets recent times", () => {
    setNow("2026-07-01T12:00:00Z");
    expect(relativeTime(utc("2026-07-01T11:59:40Z"))).toBe("just now");
    expect(relativeTime(utc("2026-07-01T11:55:00Z"))).toBe("5 min ago");
    expect(relativeTime(utc("2026-07-01T09:00:00Z"))).toBe("3 h ago");
    expect(relativeTime(utc("2026-06-30T12:00:00Z"))).toBe("yesterday");
    expect(relativeTime(utc("2026-06-28T12:00:00Z"))).toBe("3 days ago");
  });
});

describe("greeting", () => {
  afterEach(() => vi.useRealTimers());
  it("varies by time of day (UTC)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T08:00:00Z"));
    expect(greeting()).toBe("Good morning");
    vi.setSystemTime(new Date("2026-07-01T14:00:00Z"));
    expect(greeting()).toBe("Good afternoon");
    vi.setSystemTime(new Date("2026-07-01T20:00:00Z"));
    expect(greeting()).toBe("Good evening");
  });
});

describe("periodForCadence", () => {
  it("maps team cadences to period types, defaulting to week", () => {
    expect(periodForCadence("weekly")).toBe("week");
    expect(periodForCadence("monthly")).toBe("month");
    expect(periodForCadence("quarterly")).toBe("quarter");
    expect(periodForCadence("anything-else")).toBe("week");
  });
});

describe("monthStartISO / quarterStartISO", () => {
  it("returns the 1st of the containing month", () => {
    expect(monthStartISO(utc("2026-07-16T12:00:00Z"))).toBe("2026-07-01");
    expect(monthStartISO(utc("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
    expect(monthStartISO(utc("2026-12-31T23:59:59Z"))).toBe("2026-12-01");
  });
  it("returns the calendar-quarter start (Jan/Apr/Jul/Oct)", () => {
    expect(quarterStartISO(utc("2026-01-15T00:00:00Z"))).toBe("2026-01-01");
    expect(quarterStartISO(utc("2026-03-31T23:59:00Z"))).toBe("2026-01-01");
    expect(quarterStartISO(utc("2026-04-01T00:00:00Z"))).toBe("2026-04-01");
    expect(quarterStartISO(utc("2026-08-20T00:00:00Z"))).toBe("2026-07-01");
    expect(quarterStartISO(utc("2026-11-01T00:00:00Z"))).toBe("2026-10-01");
  });
});

describe("periodStartISO", () => {
  it("dispatches by period type", () => {
    const d = utc("2026-07-16T09:00:00Z"); // a Thursday
    expect(periodStartISO("week", d)).toBe("2026-07-13");
    expect(periodStartISO("month", d)).toBe("2026-07-01");
    expect(periodStartISO("quarter", d)).toBe("2026-07-01");
  });
});

describe("periodLabel / periodRange", () => {
  it("labels weeks as today", () => {
    expect(periodLabel("week", "2026-06-22")).toBe("Week 26");
    expect(periodRange("week", "2026-06-22")).toBe("22–28 Jun 2026");
  });
  it("labels months with full name and correct day count", () => {
    expect(periodLabel("month", "2026-06-01")).toBe("June 2026");
    expect(periodRange("month", "2026-06-01")).toBe("1–30 Jun 2026");
    expect(periodRange("month", "2026-02-01")).toBe("1–28 Feb 2026");
    expect(periodRange("month", "2028-02-01")).toBe("1–29 Feb 2028"); // leap year
  });
  it("labels quarters with the month span", () => {
    expect(periodLabel("quarter", "2026-04-01")).toBe("Q2 2026");
    expect(periodRange("quarter", "2026-04-01")).toBe("Apr–Jun 2026");
    expect(periodLabel("quarter", "2026-10-01")).toBe("Q4 2026");
    expect(periodRange("quarter", "2026-10-01")).toBe("Oct–Dec 2026");
  });
});
