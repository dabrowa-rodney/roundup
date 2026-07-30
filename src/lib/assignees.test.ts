import { describe, expect, it } from "vitest";
import { resolveAssignees } from "./assignees";

// Two teams: 1 is per_member (the default), 2 is shared.
const TEMPLATES = [
  { id: 10, teamId: 1 },
  { id: 11, teamId: 1 },
  { id: 20, teamId: 2 },
  { id: 21, teamId: 2 },
];
const MODES = new Map([
  [1, "per_member"],
  [2, "shared"],
]);
const MEMBERS = [
  { teamId: 1, userId: 100 },
  { teamId: 1, userId: 101 },
  { teamId: 2, userId: 200 },
  { teamId: 2, userId: 201 },
  { teamId: 2, userId: 202 },
];

const keys = (pairs: { templateId: number; userId: number }[]) =>
  pairs.map((p) => `${p.templateId}:${p.userId}`).sort();

describe("resolveAssignees", () => {
  it("uses explicit rows for a per_member team", () => {
    const out = resolveAssignees(
      [TEMPLATES[0]],
      MODES,
      [
        { templateId: 10, userId: 100 },
        { templateId: 10, userId: 101 },
      ],
      MEMBERS,
    );
    expect(keys(out)).toEqual(["10:100", "10:101"]);
  });

  it("ignores team membership for a per_member team", () => {
    // 100 and 101 are both on team 1, but only 100 is assigned.
    const out = resolveAssignees(
      [TEMPLATES[0]],
      MODES,
      [{ templateId: 10, userId: 100 }],
      MEMBERS,
    );
    expect(keys(out)).toEqual(["10:100"]);
  });

  it("expects every member of a shared team to file", () => {
    const out = resolveAssignees([TEMPLATES[2]], MODES, [], MEMBERS);
    expect(keys(out)).toEqual(["20:200", "20:201", "20:202"]);
  });

  it("ignores stale assignee rows in shared mode", () => {
    // A team switched per_member → shared with rows left behind. 999 isn't a
    // member, so they must not be expected to file; every member is.
    const out = resolveAssignees(
      [TEMPLATES[2]],
      MODES,
      [{ templateId: 20, userId: 999 }],
      MEMBERS,
    );
    expect(keys(out)).toEqual(["20:200", "20:201", "20:202"]);
  });

  it("gives a shared team's members every one of its templates", () => {
    const out = resolveAssignees(
      [TEMPLATES[2], TEMPLATES[3]],
      MODES,
      [],
      MEMBERS,
    );
    expect(keys(out)).toEqual([
      "20:200",
      "20:201",
      "20:202",
      "21:200",
      "21:201",
      "21:202",
    ]);
  });

  it("mixes modes across teams in one pass", () => {
    const out = resolveAssignees(
      TEMPLATES,
      MODES,
      [
        { templateId: 10, userId: 100 },
        { templateId: 11, userId: 101 },
      ],
      MEMBERS,
    );
    expect(keys(out)).toEqual([
      "10:100",
      "11:101",
      "20:200",
      "20:201",
      "20:202",
      "21:200",
      "21:201",
      "21:202",
    ]);
  });

  it("expects nothing from an empty shared team", () => {
    const out = resolveAssignees([{ id: 30, teamId: 3 }], new Map([[3, "shared"]]), [], []);
    expect(out).toEqual([]);
  });

  it("treats an unknown team mode as per_member", () => {
    // Defensive: a row we can't classify must not silently fan out to a team.
    const out = resolveAssignees(
      [{ id: 40, teamId: 4 }],
      new Map(),
      [{ templateId: 40, userId: 400 }],
      [{ teamId: 4, userId: 401 }],
    );
    expect(keys(out)).toEqual(["40:400"]);
  });

  it("deduplicates", () => {
    const out = resolveAssignees(
      [TEMPLATES[0]],
      MODES,
      [
        { templateId: 10, userId: 100 },
        { templateId: 10, userId: 100 },
      ],
      MEMBERS,
    );
    expect(keys(out)).toEqual(["10:100"]);
  });
});
