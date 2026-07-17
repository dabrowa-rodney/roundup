// Team-tree helpers: pure tree logic (cycle/depth safety, subtree walks) and
// the DB-bound root-team plumbing every org relies on.
//
// INVARIANTS
// - Every org has exactly one root team (parent_team_id IS NULL); the partial
//   unique index `teams_one_root_per_org` makes get-or-create race-safe.
// - The tree is acyclic and bounded: writes must go through wouldCreateCycle /
//   MAX_TEAM_DEPTH checks — the DB does not enforce either.
// - Team ids are always resolved server-side from the session org; never trust
//   a team id from the client without checking it belongs to the caller's org.

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { organisations, teamMembers, teams, users } from "@/db/schema";

/** Hard ceiling on nesting depth (root = depth 1). Deep enough for any real
 *  org chart; shallow enough to keep roll-up generation tractable. */
export const MAX_TEAM_DEPTH = 8;

export type TeamCadence = "weekly" | "monthly" | "quarterly";
export type RollupMode = "members" | "children" | "both";
export type TemplateMode = "shared" | "per_member";
export type TeamRole = "lead" | "member";

/** Minimal shape the pure tree helpers need. */
export interface TeamNode {
  id: number;
  parentTeamId: number | null;
}

/** Map of parent id (null = root) → child nodes. */
function childrenIndex<T extends TeamNode>(nodes: T[]): Map<number | null, T[]> {
  const byParent = new Map<number | null, T[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentTeamId) ?? [];
    list.push(n);
    byParent.set(n.parentTeamId, list);
  }
  return byParent;
}

/** All ids in the subtree rooted at `rootId` (inclusive), breadth-first. */
export function collectSubtreeIds(nodes: TeamNode[], rootId: number): number[] {
  const byParent = childrenIndex(nodes);
  const out: number[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    out.push(id);
    for (const child of byParent.get(id) ?? []) queue.push(child.id);
  }
  return out;
}

/** Direct children of `teamId`. */
export function childTeams<T extends TeamNode>(nodes: T[], teamId: number): T[] {
  return nodes.filter((n) => n.parentTeamId === teamId);
}

/**
 * Would re-parenting `teamId` under `newParentId` create a cycle?
 * True when newParentId is teamId itself or any of its descendants.
 */
export function wouldCreateCycle(
  nodes: TeamNode[],
  teamId: number,
  newParentId: number | null,
): boolean {
  if (newParentId === null) return false; // becoming (a) root can't cycle
  if (newParentId === teamId) return true;
  return collectSubtreeIds(nodes, teamId).includes(newParentId);
}

/** Depth of `teamId` (root = 1). 0 if the id isn't in `nodes` or the chain is
 *  broken/cyclic (walk is capped so corrupt data can't loop forever). */
export function teamDepth(nodes: TeamNode[], teamId: number): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let depth = 0;
  let cur: TeamNode | undefined = byId.get(teamId);
  while (cur && depth <= nodes.length) {
    depth++;
    cur = cur.parentTeamId === null ? undefined : byId.get(cur.parentTeamId);
    if (depth > nodes.length) return 0; // cycle in stored data — treat as invalid
  }
  return depth;
}

/** Set-diff for reconciling a user's team membership against a desired set —
 *  which team ids to add, which to remove. Ids present in both are left as-is
 *  (so an existing lead role is preserved). */
export function diffTeamMembership(
  current: number[],
  desired: number[],
): { add: number[]; remove: number[] } {
  const cur = new Set(current);
  const des = new Set(desired);
  return {
    add: desired.filter((id) => !cur.has(id)),
    remove: current.filter((id) => !des.has(id)),
  };
}

/** Path from the root down to `teamId` (inclusive) — breadcrumb order. */
export function teamPath<T extends TeamNode>(nodes: T[], teamId: number): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: T[] = [];
  let cur = byId.get(teamId);
  while (cur && path.length <= nodes.length) {
    path.unshift(cur);
    cur = cur.parentTeamId === null ? undefined : byId.get(cur.parentTeamId);
  }
  return path;
}

// ── DB-bound helpers ─────────────────────────────────────

/**
 * Get (or create) the org's root team. On first creation, enrols every
 * existing org user: global admins as leads, everyone else as members —
 * mirroring the 0007 migration so orgs created before AND after it agree.
 * Race-safe via the partial unique index.
 */
export async function ensureRootTeam(orgId: number): Promise<number> {
  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.orgId, orgId), isNull(teams.parentTeamId)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const org = (
    await db
      .select({ name: organisations.name })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1)
  )[0];

  const inserted = await db
    .insert(teams)
    .values({ orgId, name: org?.name ?? "Team" })
    .onConflictDoNothing()
    .returning({ id: teams.id });

  if (inserted.length === 0) {
    // Lost the race — another request created it; re-read.
    const again = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.orgId, orgId), isNull(teams.parentTeamId)))
      .limit(1);
    return again[0].id;
  }

  const rootId = inserted[0].id;
  const members = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.orgId, orgId));
  if (members.length > 0) {
    await db
      .insert(teamMembers)
      .values(
        members.map((u) => ({
          teamId: rootId,
          userId: u.id,
          role: u.role === "admin" ? "lead" : "member",
        })),
      )
      .onConflictDoNothing();
  }
  return rootId;
}

/** Add a user to their org's root team (idempotent). Global admins join as
 *  leads, everyone else as members — same mapping as the migration. */
export async function addUserToRootTeam(
  orgId: number,
  userId: number,
  orgRole: string,
): Promise<void> {
  const rootId = await ensureRootTeam(orgId);
  await db
    .insert(teamMembers)
    .values({
      teamId: rootId,
      userId,
      role: orgRole === "admin" ? "lead" : "member",
    })
    .onConflictDoNothing();
}
