// Google Sheets URL handling — the one place that decides what counts as a
// sheet link. Kept in its own tiny module because two very different callers
// need it: the server-side ingester (lib/sheets.ts, which fetches CSV) and the
// question/report UI (which renders the link). A client component importing the
// ingester just to validate a URL would drag the CSV parser into the bundle.
//
// The host check is load-bearing twice over:
//   • Fetching — only docs.google.com is ever requested. This is the SSRF guard.
//   • Rendering — a question's sheet is shown to contributors as a link, so the
//     stored string reaches an `href`. Matching on the path alone would accept
//     `javascript:/spreadsheets/d/x` (script URL) and `https://evil.test/
//     spreadsheets/d/x` (someone else's site), so the protocol and host are
//     checked, not just the shape of the path.

const SHEET_HOST = "docs.google.com";
const SHEET_ID = /^\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

/** Parse leniently — a pasted link often arrives without its scheme. */
function parse(url: string): URL | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      return new URL(candidate);
    } catch {
      // try the next form
    }
  }
  return null;
}

/** Build the CSV-export URL for a Google Sheets link, or null if not one. */
export function sheetCsvUrl(url: string): string | null {
  const parsed = parse(url);
  if (!parsed) return null;
  // Only https on the real host — see the note above.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.hostname.toLowerCase() !== SHEET_HOST) return null;

  const id = parsed.pathname.match(SHEET_ID)?.[1];
  if (!id) return null;

  // The tab id can arrive in the query or the fragment.
  const gid =
    parsed.searchParams.get("gid") ?? parsed.hash.match(/gid=(\d+)/)?.[1];
  return `https://${SHEET_HOST}/spreadsheets/d/${id}/export?format=csv${
    gid && /^\d+$/.test(gid) ? `&gid=${gid}` : ""
  }`;
}

/**
 * Is this a Google Sheets link we can work with? Use before storing one, and
 * again before rendering it as an href — a stored value is only as trustworthy
 * as the code that wrote it.
 */
export function isSheetUrl(url: unknown): url is string {
  return typeof url === "string" && sheetCsvUrl(url) !== null;
}

/**
 * The link in a form that is safe to put in an href: trimmed, and always with
 * an explicit https scheme so a bare `docs.google.com/...` can't be read as a
 * relative path. Undefined when it isn't a usable sheet link.
 */
export function normaliseSheetUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const parsed = parse(url);
  if (!parsed || sheetCsvUrl(url) === null) return undefined;
  parsed.protocol = "https:";
  return parsed.toString();
}
