import { describe, expect, it } from "vitest";
import { AVATAR_PALETTE, avatarColor, initials } from "./avatar";

describe("initials", () => {
  it("takes the first two words", () => {
    expect(initials("Maya Okafor")).toBe("MO");
    expect(initials("a b c d")).toBe("AB");
  });
  it("handles a single name", () => {
    expect(initials("Cher")).toBe("C");
  });
  it("uppercases", () => {
    expect(initials("john smith")).toBe("JS");
  });
});

describe("avatarColor", () => {
  it("is deterministic for a given name", () => {
    expect(avatarColor("Priya Shah")).toBe(avatarColor("Priya Shah"));
  });
  it("always returns a palette colour", () => {
    for (const name of ["Maya", "Tom Reeves", "x", "Sofia Marin"]) {
      expect(AVATAR_PALETTE).toContain(avatarColor(name));
    }
  });
});
