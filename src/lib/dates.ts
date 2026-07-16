// Small date helpers for the weekly lifecycle + relative timestamps.
// Weeks run Monday → Sunday; the Monday 00:00 (UTC) is the canonical weekStart.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Monday (00:00 UTC) of the week containing `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** "YYYY-MM-DD" for a date's UTC calendar day. */
export function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * Canonical weekStart as a plain date string ("YYYY-MM-DD" of the Monday).
 * Stored/compared as a SQL `date` — no time, no timezone — so it round-trips
 * cleanly through URLs and the driver.
 */
export function mondayISO(date: Date): string {
  return toISODate(mondayOf(date));
}

/** Parse a "YYYY-MM-DD" week string back to a UTC-midnight Date (for labels). */
export function parseISODate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

/** ISO-8601 week number for `date`. */
export function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604_800_000);
}

/** e.g. "22–28 Jun 2026" (spanning months: "29 Jun–5 Jul 2026"). */
export function weekRange(monday: Date): string {
  const end = new Date(monday);
  end.setUTCDate(end.getUTCDate() + 6);
  const m1 = MONTHS[monday.getUTCMonth()];
  const m2 = MONTHS[end.getUTCMonth()];
  const y = end.getUTCFullYear();
  return m1 === m2
    ? `${monday.getUTCDate()}–${end.getUTCDate()} ${m2} ${y}`
    : `${monday.getUTCDate()} ${m1}–${end.getUTCDate()} ${m2} ${y}`;
}

/** e.g. "Week 26 · 22–28 Jun 2026". */
export function weekLabel(monday: Date): string {
  return `Week ${isoWeek(monday)} · ${weekRange(monday)}`;
}

/** Short "Week NN" label. */
export function weekNumberLabel(monday: Date): string {
  return `Week ${isoWeek(monday)}`;
}

// ── Periods (team-cadence roundups) ─────────────────────
// Calendar-aligned in the org timezone (D4): weeks start Monday (as above),
// months on the 1st, quarters on 1 Jan / 1 Apr / 1 Jul / 1 Oct. period_start
// stored as "YYYY-MM-DD", same as weekStart.

export type PeriodType = "week" | "month" | "quarter";

/** The team cadence values ('weekly' | ...) map onto period types. */
export function periodForCadence(cadence: string): PeriodType {
  return cadence === "monthly"
    ? "month"
    : cadence === "quarterly"
      ? "quarter"
      : "week";
}

/** "YYYY-MM-01" for the calendar month containing `date`. */
export function monthStartISO(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** First day of the calendar quarter containing `date` (Jan/Apr/Jul/Oct 1st). */
export function quarterStartISO(date: Date): string {
  const qMonth = Math.floor(date.getUTCMonth() / 3) * 3 + 1;
  return `${date.getUTCFullYear()}-${String(qMonth).padStart(2, "0")}-01`;
}

/** Canonical period_start for a period type containing `date`. */
export function periodStartISO(period: PeriodType, date: Date): string {
  if (period === "month") return monthStartISO(date);
  if (period === "quarter") return quarterStartISO(date);
  return mondayISO(date);
}

/** Start of the FOLLOWING period — the exclusive end of [start, next). */
export function nextPeriodStartISO(period: PeriodType, startISO: string): string {
  const d = parseISODate(startISO);
  if (period === "month") {
    return monthStartISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
  }
  if (period === "quarter") {
    return quarterStartISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1)));
  }
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 7);
  return toISODate(next);
}

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Short heading, e.g. "Week 26" / "June 2026" / "Q2 2026". */
export function periodLabel(period: PeriodType, startISO: string): string {
  const d = parseISODate(startISO);
  if (period === "month")
    return `${MONTHS_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (period === "quarter")
    return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  return weekNumberLabel(d);
}

/** Date-range subtitle, e.g. "22–28 Jun 2026" / "1–30 Jun 2026" / "Apr–Jun 2026". */
export function periodRange(period: PeriodType, startISO: string): string {
  const d = parseISODate(startISO);
  if (period === "month") {
    const days = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return `1–${days} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  if (period === "quarter") {
    const endMonth = d.getUTCMonth() + 2;
    return `${MONTHS[d.getUTCMonth()]}–${MONTHS[endMonth]} ${d.getUTCFullYear()}`;
  }
  return weekRange(d);
}

/** Coarse relative time, e.g. "2 min ago", "3 h ago", "yesterday". */
export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const then = typeof date === "string" ? new Date(date) : date;
  const secs = Math.floor((Date.now() - then.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return `${then.getUTCDate()} ${MONTHS[then.getUTCMonth()]}`;
}

/** Time-of-day greeting for the current server hour. */
export function greeting(): string {
  const h = new Date().getUTCHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
