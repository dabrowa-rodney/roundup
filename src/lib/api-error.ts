// Client-side helpers for reading API responses.
//
// Why this exists: a route handler that throws (a bad query, a missing column
// after a skipped migration) returns a 500 whose body is NOT JSON. Calling
// `res.json()` on that throws, so a `try/catch` around the fetch reports its
// generic fallback ("Failed to create sub-team") and the real server error is
// invisible — the failure looks like a client bug. These helpers make a
// non-JSON body and an HTTP status legible instead.

/** Parse a JSON body, returning null instead of throwing on a non-JSON body. */
export async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** A string `error` field from a parsed API body, if there is one. */
export function errorFromBody(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error: unknown }).error;
    if (typeof e === "string" && e.trim()) return e.trim();
  }
  return "";
}

/**
 * The message to show for a failed response. The API's own `error` wins; for a
 * body-less failure the status is surfaced so a server fault reads as one
 * (rather than as an unexplained client-side failure).
 */
export function apiErrorMessage(
  status: number,
  body: unknown,
  fallback = "Something went wrong.",
): string {
  const fromBody = errorFromBody(body);
  if (fromBody) return fromBody;
  if (status >= 500) {
    return `The server hit an error (${status}). Please try again — if it keeps happening, this needs a developer.`;
  }
  if (status === 401 || status === 403) {
    return "You don't have permission to do that.";
  }
  if (status === 404) return "That item no longer exists — try reloading.";
  return fallback;
}
