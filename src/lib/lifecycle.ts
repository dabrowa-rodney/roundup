// Weekly open/close lifecycle. The schedule (close/reopen day+time) is stored in
// London wall-clock; these helpers turn a week into absolute UTC instants so we
// can decide, at any moment, whether a week is open, closed, or upcoming.
//
// Locking is DERIVED from this at request time (so it's correct even if the cron
// is delayed); the cron just persists status='locked' and opens the new week.

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
