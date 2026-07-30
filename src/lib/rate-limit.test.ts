import { describe, expect, it } from "vitest";
import { retryAfterSeconds, windowStartFor } from "./rate-limit";

const HOUR = 60 * 60 * 1000;

describe("windowStartFor", () => {
  it("snaps to the start of the containing fixed window", () => {
    expect(
      windowStartFor(new Date("2026-07-29T10:37:12Z"), HOUR).toISOString(),
    ).toBe("2026-07-29T10:00:00.000Z");
    expect(
      windowStartFor(new Date("2026-07-29T10:00:00Z"), HOUR).toISOString(),
    ).toBe("2026-07-29T10:00:00.000Z");
  });
  it("puts times in the same hour in the same window, and the next hour in the next", () => {
    const a = windowStartFor(new Date("2026-07-29T10:01:00Z"), HOUR);
    const b = windowStartFor(new Date("2026-07-29T10:59:59Z"), HOUR);
    const c = windowStartFor(new Date("2026-07-29T11:00:00Z"), HOUR);
    expect(a.getTime()).toBe(b.getTime());
    expect(c.getTime()).toBe(a.getTime() + HOUR);
  });
  it("supports other window lengths", () => {
    const min = 60 * 1000;
    expect(
      windowStartFor(new Date("2026-07-29T10:37:45Z"), min).toISOString(),
    ).toBe("2026-07-29T10:37:00.000Z");
  });
});

describe("retryAfterSeconds", () => {
  it("reports the seconds left in the window", () => {
    const now = new Date("2026-07-29T10:30:00Z");
    const result = {
      ok: false,
      count: 11,
      limit: 10,
      resetAt: new Date("2026-07-29T11:00:00Z"),
    };
    expect(retryAfterSeconds(result, now)).toBe(1800);
  });
  it("never returns less than a second, even past the reset", () => {
    const now = new Date("2026-07-29T11:00:05Z");
    const result = {
      ok: false,
      count: 11,
      limit: 10,
      resetAt: new Date("2026-07-29T11:00:00Z"),
    };
    expect(retryAfterSeconds(result, now)).toBe(1);
  });
});
