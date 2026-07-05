import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugify, slugProblem } from "./org";

describe("slugify", () => {
  it("derives a clean slug from an org name", () => {
    expect(slugify("Acme Ltd")).toBe("acme-ltd");
    expect(slugify("  Wondé & Co!  ")).toBe("wonde-co");
    expect(slugify("---")).toBe("");
  });
});

describe("slugProblem", () => {
  it("accepts valid slugs", () => {
    expect(slugProblem("acme")).toBeNull();
    expect(slugProblem("acme-ltd-2")).toBeNull();
  });
  it("rejects bad shapes", () => {
    expect(slugProblem("ab")).not.toBeNull(); // too short
    expect(slugProblem("-acme")).not.toBeNull();
    expect(slugProblem("Acme")).not.toBeNull(); // uppercase
    expect(slugProblem("a".repeat(31))).not.toBeNull();
  });
  it("rejects reserved names", () => {
    for (const r of ["www", "api", "admin"]) {
      expect(RESERVED_SLUGS.has(r)).toBe(true);
      expect(slugProblem(r)).toBe("That name is reserved.");
    }
  });
});
