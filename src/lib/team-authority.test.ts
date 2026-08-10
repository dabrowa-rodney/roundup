import { describe, expect, it } from "vitest";
import {
  canArchiveTeam,
  canCreateSubTeam,
  canManageTeam,
  canMoveTeam,
  hasAnyTeamAuthority,
  teamAuthority,
} from "./team-authority";
import type { TeamNode } from "./teams";

//   1 root
//   ├─ 2 Engineering
//   │   ├─ 4 Platform
//   │   └─ 5 Mobile
//   └─ 3 Sales
const TREE: TeamNode[] = [
  { id: 1, parentTeamId: null },
  { id: 2, parentTeamId: 1 },
  { id: 3, parentTeamId: 1 },
  { id: 4, parentTeamId: 2 },
  { id: 5, parentTeamId: 2 },
];

const admin = () => teamAuthority(TREE, [], true);
const engLead = () => teamAuthority(TREE, [2], false);
const nobody = () => teamAuthority(TREE, [], false);

describe("teamAuthority", () => {
  it("gives an org admin every team", () => {
    expect([...admin().managedTeamIds].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("gives a lead their team plus all descendants", () => {
    expect([...engLead().managedTeamIds].sort()).toEqual([2, 4, 5]);
  });
  it("gives a plain member nothing", () => {
    expect(nobody().managedTeamIds.size).toBe(0);
    expect(hasAnyTeamAuthority(nobody())).toBe(false);
    expect(hasAnyTeamAuthority(engLead())).toBe(true);
  });
  it("unions multiple lead memberships", () => {
    const both = teamAuthority(TREE, [3, 4], false);
    expect([...both.managedTeamIds].sort()).toEqual([3, 4]);
  });
});

describe("canManageTeam", () => {
  it("lets a lead act inside their subtree only", () => {
    const a = engLead();
    expect(canManageTeam(a, 2)).toBe(true); // own team
    expect(canManageTeam(a, 4)).toBe(true); // descendant
    expect(canManageTeam(a, 1)).toBe(false); // parent — above them
    expect(canManageTeam(a, 3)).toBe(false); // sibling branch
  });
  it("lets an org admin act anywhere", () => {
    for (const id of [1, 2, 3, 4, 5]) expect(canManageTeam(admin(), id)).toBe(true);
  });
});

describe("canCreateSubTeam", () => {
  it("follows manage rights on the parent", () => {
    expect(canCreateSubTeam(engLead(), 2)).toBe(true);
    expect(canCreateSubTeam(engLead(), 4)).toBe(true);
    expect(canCreateSubTeam(engLead(), 1)).toBe(false); // can't add a sibling
    expect(canCreateSubTeam(engLead(), 3)).toBe(false);
  });
});

describe("canArchiveTeam", () => {
  it("refuses a lead archiving the source of their own authority", () => {
    // Otherwise a lead could delete their own mandate (and the whole subtree).
    expect(canArchiveTeam(engLead(), 2)).toBe(false);
  });
  it("allows a lead to archive descendants", () => {
    expect(canArchiveTeam(engLead(), 4)).toBe(true);
    expect(canArchiveTeam(engLead(), 5)).toBe(true);
  });
  it("refuses teams outside the subtree", () => {
    expect(canArchiveTeam(engLead(), 3)).toBe(false);
    expect(canArchiveTeam(engLead(), 1)).toBe(false);
  });
  it("lets an org admin archive anything (the root is blocked elsewhere)", () => {
    expect(canArchiveTeam(admin(), 2)).toBe(true);
  });
});

describe("canMoveTeam", () => {
  it("allows reorganising within the subtree", () => {
    // Move Platform(4) under Mobile(5) — both inside Engineering.
    expect(canMoveTeam(engLead(), 4, 5)).toBe(true);
  });
  it("refuses pushing a team OUT of the caller's authority", () => {
    expect(canMoveTeam(engLead(), 4, 3)).toBe(false); // into Sales
    expect(canMoveTeam(engLead(), 4, 1)).toBe(false); // up to root
  });
  it("refuses pulling a foreign team IN", () => {
    expect(canMoveTeam(engLead(), 3, 2)).toBe(false);
  });
  it("refuses moving the team their authority comes from", () => {
    expect(canMoveTeam(engLead(), 2, 4)).toBe(false);
  });
  it("lets an org admin move anything", () => {
    expect(canMoveTeam(admin(), 4, 3)).toBe(true);
  });
});
