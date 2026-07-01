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
