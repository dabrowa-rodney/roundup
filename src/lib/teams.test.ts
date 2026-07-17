import { describe, expect, it } from "vitest";
import {
  collectSubtreeIds,
  childTeams,
  diffTeamMembership,
  teamDepth,
  teamPath,
  wouldCreateCycle,
  type TeamNode,
} from "./teams";

// A 3-level tree:
//   1 (root)
//   ├─ 2 ── 4
//   │      └─ 5
//   └─ 3
// plus a second org's root (10) to make sure walks don't leak across trees.
const TREE: TeamNode[] = [
  { id: 1, parentTeamId: null },
  { id: 2, parentTeamId: 1 },
  { id: 3, parentTeamId: 1 },
  { id: 4, parentTeamId: 2 },
  { id: 5, parentTeamId: 4 },
  { id: 10, parentTeamId: null },
];

describe("collectSubtreeIds", () => {
  it("returns the whole subtree, inclusive", () => {
    expect(collectSubtreeIds(TREE, 2).sort()).toEqual([2, 4, 5]);
  });
  it("returns just the node for a leaf", () => {
    expect(collectSubtreeIds(TREE, 3)).toEqual([3]);
  });
  it("covers the full tree from the root without leaking to other roots", () => {
    expect(collectSubtreeIds(TREE, 1).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("childTeams", () => {
  it("returns direct children only", () => {
    expect(childTeams(TREE, 1).map((t) => t.id)).toEqual([2, 3]);
    expect(childTeams(TREE, 4).map((t) => t.id)).toEqual([5]);
  });
  it("is empty for a leaf", () => {
    expect(childTeams(TREE, 5)).toEqual([]);
  });
});

describe("wouldCreateCycle", () => {
  it("rejects parenting a team to itself", () => {
    expect(wouldCreateCycle(TREE, 2, 2)).toBe(true);
  });
  it("rejects parenting to a descendant (direct and deep)", () => {
    expect(wouldCreateCycle(TREE, 2, 4)).toBe(true);
    expect(wouldCreateCycle(TREE, 2, 5)).toBe(true);
    expect(wouldCreateCycle(TREE, 1, 5)).toBe(true);
  });
  it("allows moving to a sibling or unrelated branch", () => {
    expect(wouldCreateCycle(TREE, 4, 3)).toBe(false);
    expect(wouldCreateCycle(TREE, 3, 4)).toBe(false);
  });
  it("allows detaching to root", () => {
    expect(wouldCreateCycle(TREE, 2, null)).toBe(false);
  });
});

describe("teamDepth", () => {
  it("counts from 1 at the root", () => {
    expect(teamDepth(TREE, 1)).toBe(1);
    expect(teamDepth(TREE, 2)).toBe(2);
    expect(teamDepth(TREE, 4)).toBe(3);
    expect(teamDepth(TREE, 5)).toBe(4);
  });
  it("returns 0 for an unknown id", () => {
    expect(teamDepth(TREE, 99)).toBe(0);
  });
  it("does not loop forever on corrupt (cyclic) data", () => {
    const cyclic: TeamNode[] = [
      { id: 1, parentTeamId: 2 },
      { id: 2, parentTeamId: 1 },
    ];
    expect(teamDepth(cyclic, 1)).toBe(0);
  });
});

describe("teamPath", () => {
  it("walks root → node in breadcrumb order", () => {
    expect(teamPath(TREE, 5).map((t) => t.id)).toEqual([1, 2, 4, 5]);
  });
  it("is just the node for a root", () => {
    expect(teamPath(TREE, 1).map((t) => t.id)).toEqual([1]);
  });
});

describe("diffTeamMembership", () => {
  it("adds newly-selected teams and removes deselected ones", () => {
    expect(diffTeamMembership([1, 2], [2, 3])).toEqual({
      add: [3],
      remove: [1],
    });
  });
  it("leaves unchanged teams alone (preserves an existing role)", () => {
    expect(diffTeamMembership([1, 2, 3], [1, 2, 3])).toEqual({
      add: [],
      remove: [],
    });
  });
  it("handles adding to an empty set and clearing to empty", () => {
    expect(diffTeamMembership([], [5, 6])).toEqual({ add: [5, 6], remove: [] });
    expect(diffTeamMembership([5, 6], [])).toEqual({ add: [], remove: [5, 6] });
  });
});
