import { describe, expect, it } from "vitest";
import {
  closeInstant,
  isWeekClosed,
  isWeekOpen,
  reopenInstant,
  type ScheduleSettings,
} from "./lifecycle";

const LONDON: ScheduleSettings = {
  closeDay: "Sunday",
  closeTime: "20:00",
  openDay: "Monday",
  openTime: "01:00",
  timezone: "Europe/London",
};

describe("closeInstant", () => {
  it("resolves Sunday 20:00 in BST (summer, +1)", () => {
    expect(closeInstant("2026-06-29", LONDON).toISOString()).toBe(
      "2026-07-05T19:00:00.000Z",
    );
  });
  it("resolves Sunday 20:00 in GMT (winter, +0)", () => {
    expect(closeInstant("2026-01-05", LONDON).toISOString()).toBe(
      "2026-01-11T20:00:00.000Z",
    );
  });
  it("honours a custom close day/time (Friday 20:00 BST)", () => {
    const s = { ...LONDON, closeDay: "Friday" };
    expect(closeInstant("2026-06-29", s).toISOString()).toBe(
      "2026-07-03T19:00:00.000Z",
    );
  });
});

describe("reopenInstant", () => {
  it("resolves Monday 01:00 BST to midnight UTC", () => {
    expect(reopenInstant("2026-06-29", LONDON).toISOString()).toBe(
      "2026-06-29T00:00:00.000Z",
    );
  });
});

describe("isWeekClosed / isWeekOpen", () => {
  const before = new Date("2026-07-05T18:59:00Z"); // 1 min before close
  const after = new Date("2026-07-05T19:01:00Z"); // 1 min after close
  const midweek = new Date("2026-07-01T12:00:00Z");
  const beforeReopen = new Date("2026-06-28T23:00:00Z"); // Sun, before Mon 01:00 BST

  it("is not closed before the close instant", () => {
    expect(isWeekClosed("2026-06-29", LONDON, before)).toBe(false);
  });
  it("is closed after the close instant", () => {
    expect(isWeekClosed("2026-06-29", LONDON, after)).toBe(true);
  });
  it("is open mid-week", () => {
    expect(isWeekOpen("2026-06-29", LONDON, midweek)).toBe(true);
  });
  it("is not open before reopen", () => {
    expect(isWeekOpen("2026-06-29", LONDON, beforeReopen)).toBe(false);
  });
  it("is not open after close", () => {
    expect(isWeekOpen("2026-06-29", LONDON, after)).toBe(false);
  });
});
