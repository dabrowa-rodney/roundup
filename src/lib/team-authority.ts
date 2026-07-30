// Who may manage which teams (design decision D3).
//
// Two kinds of authority:
//   • ORG ADMIN (users.role='admin') — anything, anywhere in their org.
//   • TEAM LEAD (team_members.role='lead') — their own team and everything
//     beneath it. Delegating to the people who actually run those teams is the
//     point of the hierarchy; org admins would otherwise be a bottleneck.
//
// Everything here is pure so the rules are testable without a database. The
// routes resolve the caller's lead memberships, call these, and enforce.
//
// SAFETY RULES encoded below:
//   – A lead may not archive or move the team that is the SOURCE of their
//     authority (that would let them delete or relocate their own mandate);
//     only their parent's lead or an org admin can.
//   – A re-parent must keep the team inside the mover's authority: both the
//     team and its new parent must be manageable by them, so a lead can
//     reorganise within their subtree but not push a team out of it (or pull
//     one in from elsewhere).
//   – Nothing here grants org-level powers (billing, settings, roles).

import { collectSubtreeIds, type TeamNode } from "./teams";

export interface TeamAuthority {
  isOrgAdmin: boolean;
  /** Teams the caller leads directly (the roots of their authority). */
  leadTeamIds: number[];
  /** Those teams plus every descendant — what they can act on. */
  managedTeamIds: Set<number>;
}

/**
 * Expand direct lead memberships into the full set of teams a caller manages.
 * An org admin manages every team in the org.
 */
export function teamAuthority(
  teams: TeamNode[],
  leadTeamIds: number[],
  isOrgAdmin: boolean,
): TeamAuthority {
  if (isOrgAdmin) {
    return {
      isOrgAdmin: true,
      leadTeamIds,
      managedTeamIds: new Set(teams.map((t) => t.id)),
    };
  }
  const managed = new Set<number>();
  for (const id of leadTeamIds) {
    for (const descendant of collectSubtreeIds(teams, id)) managed.add(descendant);
  }
  return { isOrgAdmin: false, leadTeamIds, managedTeamIds: managed };
}

/** May the caller act on this team at all (configure, add members, generate)? */
export function canManageTeam(auth: TeamAuthority, teamId: number): boolean {
  return auth.isOrgAdmin || auth.managedTeamIds.has(teamId);
}

/** May the caller create a sub-team under `parentTeamId`? */
export function canCreateSubTeam(
  auth: TeamAuthority,
  parentTeamId: number,
): boolean {
  return canManageTeam(auth, parentTeamId);
}

/**
 * May the caller archive (or restore) this team? A lead can't archive the team
 * their own authority comes from — that would remove their mandate and take a
 * whole subtree down with it. Descendants are fair game.
 */
export function canArchiveTeam(auth: TeamAuthority, teamId: number): boolean {
  if (auth.isOrgAdmin) return true;
  if (auth.leadTeamIds.includes(teamId)) return false;
  return auth.managedTeamIds.has(teamId);
}

/**
 * May the caller move `teamId` under `newParentId`? Both ends must be within
 * their authority, and (as with archiving) a lead can't relocate the team their
 * authority derives from.
 */
export function canMoveTeam(
  auth: TeamAuthority,
  teamId: number,
  newParentId: number,
): boolean {
  if (auth.isOrgAdmin) return true;
  if (auth.leadTeamIds.includes(teamId)) return false;
  return auth.managedTeamIds.has(teamId) && auth.managedTeamIds.has(newParentId);
}

/** Can the caller see the Roundups area at all? */
export function hasAnyTeamAuthority(auth: TeamAuthority): boolean {
  return auth.isOrgAdmin || auth.managedTeamIds.size > 0;
}
