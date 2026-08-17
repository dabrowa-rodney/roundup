import { describe, expect, it } from "vitest";
import { isSheetUrl, normaliseSheetUrl, sheetCsvUrl } from "./sheet-url";
import { questionSheets } from "./questions";

const REAL =
  "https://docs.google.com/spreadsheets/d/1AbC-dEf_GhI/edit#gid=42";

describe("sheetCsvUrl", () => {
  it("builds the CSV export URL, keeping the tab", () => {
    expect(sheetCsvUrl(REAL)).toBe(
      "https://docs.google.com/spreadsheets/d/1AbC-dEf_GhI/export?format=csv&gid=42",
    );
  });

  it("omits gid when the link has no tab", () => {
    expect(
      sheetCsvUrl("https://docs.google.com/spreadsheets/d/1AbC-dEf_GhI/edit"),
    ).toBe(
      "https://docs.google.com/spreadsheets/d/1AbC-dEf_GhI/export?format=csv",
    );
  });

  it("rejects anything that isn't a spreadsheet link", () => {
    expect(sheetCsvUrl("https://example.com/data.csv")).toBeNull();
    expect(sheetCsvUrl("https://docs.google.com/document/d/abc/edit")).toBeNull();
    expect(sheetCsvUrl("not a url")).toBeNull();
  });
});

describe("isSheetUrl", () => {
  it("accepts a sheet link, with or without surrounding space", () => {
    expect(isSheetUrl(REAL)).toBe(true);
    expect(isSheetUrl(`  ${REAL}  `)).toBe(true);
  });

  it("rejects non-strings and empty values", () => {
    expect(isSheetUrl(undefined)).toBe(false);
    expect(isSheetUrl(null)).toBe(false);
    expect(isSheetUrl(42)).toBe(false);
    expect(isSheetUrl({ url: REAL })).toBe(false);
    expect(isSheetUrl("")).toBe(false);
  });

  // The reason this check exists: the value ends up in an href, and is fetched
  // server-side during generation.
  it("rejects script and internal-network URLs", () => {
    expect(isSheetUrl("javascript:alert(1)")).toBe(false);
    expect(isSheetUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSheetUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isSheetUrl("http://localhost:5432/")).toBe(false);
    expect(isSheetUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects a lookalike host", () => {
    expect(isSheetUrl("https://evil.test/spreadsheets/d/1AbC/edit")).toBe(false);
    expect(
      isSheetUrl("https://docs.google.com.evil.test/spreadsheets/d/1AbC/edit"),
    ).toBe(false);
    // A script URL whose body happens to contain the expected path.
    expect(isSheetUrl("javascript:/spreadsheets/d/abc")).toBe(false);
  });
});

describe("normaliseSheetUrl", () => {
  it("trims a valid link and drops an invalid one", () => {
    expect(normaliseSheetUrl(`  ${REAL} `)).toBe(REAL);
    expect(normaliseSheetUrl("javascript:alert(1)")).toBeUndefined();
    expect(normaliseSheetUrl(undefined)).toBeUndefined();
  });

  // A pasted link often arrives without its scheme; an href must never be left
  // to read that as a relative path.
  it("gives a scheme-less link an explicit https", () => {
    expect(
      normaliseSheetUrl("docs.google.com/spreadsheets/d/1AbC-dEf_GhI/edit"),
    ).toBe("https://docs.google.com/spreadsheets/d/1AbC-dEf_GhI/edit");
  });

  it("upgrades http to https", () => {
    expect(
      normaliseSheetUrl("http://docs.google.com/spreadsheets/d/1AbC/edit"),
    ).toBe("https://docs.google.com/spreadsheets/d/1AbC/edit");
  });
});

describe("questionSheets", () => {
  const OTHER = "https://docs.google.com/spreadsheets/d/9ZyX/edit";

  it("returns the sheets list with trimmed titles, in order", () => {
    expect(
      questionSheets({
        sheets: [
          { title: "  Weekly sales  ", url: REAL },
          { url: OTHER },
        ],
      }),
    ).toEqual([
      { title: "Weekly sales", url: REAL },
      { title: undefined, url: OTHER },
    ]);
  });

  it("reads the legacy single sheetUrl as a one-item list", () => {
    expect(questionSheets({ sheetUrl: REAL })).toEqual([{ url: REAL }]);
  });

  it("prefers the sheets list over the legacy field", () => {
    expect(
      questionSheets({ sheets: [{ url: OTHER }], sheetUrl: REAL }),
    ).toEqual([{ title: undefined, url: OTHER }]);
  });

  it("is empty when there's no sheet", () => {
    expect(questionSheets({})).toEqual([]);
    expect(questionSheets({ helper: "hi" })).toEqual([]);
    expect(questionSheets({ sheets: [] })).toEqual([]);
  });

  // Defence in depth: a stored value is only as trustworthy as whatever wrote
  // it, so a bad one must be dropped rather than reach an anchor — without
  // sinking the valid sheets around it.
  it("drops stored non-sheet URLs, keeping valid neighbours", () => {
    expect(
      questionSheets({
        sheets: [
          { title: "bad", url: "javascript:alert(1)" },
          { title: "good", url: REAL },
          { url: "https://evil.test/" },
        ],
      }),
    ).toEqual([{ title: "good", url: REAL }]);
    expect(questionSheets({ sheetUrl: "javascript:alert(1)" })).toEqual([]);
  });

  it("survives malformed entries", () => {
    expect(
      questionSheets({
        sheets: [null, 42, "x", { title: "no url" }, { url: REAL }],
      } as never),
    ).toEqual([{ title: undefined, url: REAL }]);
  });
});
