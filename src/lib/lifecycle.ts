// Period open/close lifecycle. The schedule (close/reopen day+time) is stored in
// London wall-clock; these helpers turn a period into absolute UTC instants so we
// can decide, at any moment, whether it is open, closed, or upcoming.
//
// Weekly periods use the org schedule as ever (close Sunday 20:00 etc.).
// Monthly/quarterly periods (per-team cadences) are calendar-aligned: they open
// on their FIRST day at the org's openTime and close on their LAST day at the
// org's closeTime — the day-of-week fields don't apply.
//
// Locking is DERIVED from this at request time (so it's correct even if the cron
// is delayed); the cron just persists status='locked' and opens the new period.

import { nextPeriodStartISO, parseISODate, type PeriodType } from "./dates";

export interface ScheduleSettings {
  closeDay: string; // "Monday" … "Sunday"
  closeTime: string; // "HH:MM"
  openDay: string;
  openTime: string;
  timezone: string; // e.g. "Europe/London"
}

const DAY_OFFSET: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

/** Milliseconds that `tz` is ahead of UTC at the given instant. */
function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - at.getTime();
}

/** UTC instant for a wall-clock time in `tz`. */
function wallClockToUtc(
  y: number,
  monthIndex: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, monthIndex, d, h, mi);
  const offset = tzOffsetMs(tz, new Date(guess));
  return new Date(guess - offset);
}

/** The instant (day-of-week + time in tz) for a given week's Monday. */
function instantFor(
  weekStartISO: string,
  day: string,
  time: string,
  tz: string,
): Date {
  const [y, m, d] = weekStartISO.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + (DAY_OFFSET[day] ?? 6));
  const [hh, mm] = time.split(":").map(Number);
  return wallClockToUtc(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    hh || 0,
    mm || 0,
    tz,
  );
}

export function closeInstant(weekStartISO: string, s: ScheduleSettings): Date {
  return instantFor(weekStartISO, s.closeDay, s.closeTime, s.timezone);
}

/** UTC instant for an arbitrary day+time slot within a week (e.g. a reminder). */
export function slotInstant(
  weekStartISO: string,
  day: string,
  time: string,
  timezone: string,
): Date {
  return instantFor(weekStartISO, day, time, timezone);
}

export function reopenInstant(weekStartISO: string, s: ScheduleSettings): Date {
  return instantFor(weekStartISO, s.openDay, s.openTime, s.timezone);
}

/** Has this week's close time passed? */
export function isWeekClosed(
  weekStartISO: string,
  s: ScheduleSettings,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= closeInstant(weekStartISO, s).getTime();
}

/** Is the week currently open for editing (past reopen, before close)? */
export function isWeekOpen(
  weekStartISO: string,
  s: ScheduleSettings,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  return (
    t >= reopenInstant(weekStartISO, s).getTime() &&
    t < closeInstant(weekStartISO, s).getTime()
  );
}

// ── Period-generalised instants (per-team cadences) ─────

/** When a period opens: weekly → org reopen slot; monthly/quarterly → the
 *  period's first calendar day at the org's openTime. */
export function periodOpenInstant(
  period: PeriodType,
  periodStartISO: string,
  s: ScheduleSettings,
): Date {
  if (period === "week") return reopenInstant(periodStartISO, s);
  const d = parseISODate(periodStartISO);
  const [hh, mm] = s.openTime.split(":").map(Number);
  return wallClockToUtc(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    hh || 0,
    mm || 0,
    s.timezone,
  );
}

/** When a period closes: weekly → org close slot; monthly/quarterly → the
 *  period's LAST calendar day at the org's closeTime. */
export function periodCloseInstant(
  period: PeriodType,
  periodStartISO: string,
  s: ScheduleSettings,
): Date {
  if (period === "week") return closeInstant(periodStartISO, s);
  const end = parseISODate(nextPeriodStartISO(period, periodStartISO));
  end.setUTCDate(end.getUTCDate() - 1);
  const [hh, mm] = s.closeTime.split(":").map(Number);
  return wallClockToUtc(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
    hh || 0,
    mm || 0,
    s.timezone,
  );
}

/** Has this period's close time passed? */
export function isPeriodClosed(
  period: PeriodType,
  periodStartISO: string,
  s: ScheduleSettings,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= periodCloseInstant(period, periodStartISO, s).getTime();
}

/** Is the period currently open for editing (past open, before close)? */
export function isPeriodOpen(
  period: PeriodType,
  periodStartISO: string,
  s: ScheduleSettings,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  return (
    t >= periodOpenInstant(period, periodStartISO, s).getTime() &&
    t < periodCloseInstant(period, periodStartISO, s).getTime()
  );
}
