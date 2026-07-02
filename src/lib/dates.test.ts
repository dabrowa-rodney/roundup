import { afterEach, describe, expect, it, vi } from "vitest";
import {
  greeting,
  isoWeek,
  mondayISO,
  mondayOf,
  parseISODate,
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
