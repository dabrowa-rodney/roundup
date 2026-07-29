import { describe, expect, it } from "vitest";
import { apiErrorMessage, errorFromBody, safeJson } from "./api-error";

describe("errorFromBody", () => {
  it("pulls a string error field", () => {
    expect(errorFromBody({ error: "Team not found" })).toBe("Team not found");
  });
  it("trims and ignores empty / non-string / missing errors", () => {
    expect(errorFromBody({ error: "  spaced  " })).toBe("spaced");
    expect(errorFromBody({ error: "   " })).toBe("");
    expect(errorFromBody({ error: 500 })).toBe("");
    expect(errorFromBody({})).toBe("");
    expect(errorFromBody(null)).toBe("");
    expect(errorFromBody("a string body")).toBe("");
  });
});

describe("apiErrorMessage", () => {
  it("prefers the API's own message", () => {
    expect(apiErrorMessage(403, { error: "Business feature" })).toBe(
      "Business feature",
    );
  });
  it("names a server fault when the body has no message (the missed-migration case)", () => {
    // A thrown route handler returns non-JSON, so the body parses to null.
    const msg = apiErrorMessage(500, null);
    expect(msg).toContain("500");
    expect(msg).toMatch(/server/i);
  });
  it("explains auth and missing-item failures", () => {
    expect(apiErrorMessage(403, null)).toMatch(/permission/i);
    expect(apiErrorMessage(401, null)).toMatch(/permission/i);
    expect(apiErrorMessage(404, null)).toMatch(/no longer exists/i);
  });
  it("falls back to the caller's message for other statuses", () => {
    expect(apiErrorMessage(400, null, "Couldn't create the sub-team.")).toBe(
      "Couldn't create the sub-team.",
    );
  });
});

describe("safeJson", () => {
  it("parses a JSON body", async () => {
    const res = new Response(JSON.stringify({ error: "nope" }), {
      headers: { "Content-Type": "application/json" },
    });
    expect(await safeJson(res)).toEqual({ error: "nope" });
  });
  it("returns null for a non-JSON body instead of throwing", async () => {
    const res = new Response("<!DOCTYPE html><h1>Internal Server Error</h1>", {
      status: 500,
    });
    expect(await safeJson(res)).toBeNull();
  });
});
