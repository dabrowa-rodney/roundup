// Who is expected to file a report template.
//
// A team decides this once, with `teams.template_mode` (confirmed decision 3 in
// docs/DESIGN-nested-teams.md):
//
//   per_member (default) — explicit `report_assignees` rows. Each member is
//                          assigned their own template(s).
//   shared               — every member of the template's team fills it. No
//                          assignee rows are needed, and any that exist are
//                          IGNORED rather than merged, so flipping a team
//                          between modes is predictable in both directions.
//
// A shared team is meant to have one template; if it has several, each member
// is expected to file each of them. That falls out of the rule rather than
// being a special case.
//
// Every "who owes a report" question funnels through here — the lifecycle open
// step, generate's expected count, reminders, and the my-reports surfaces — so
// the rule can't drift between them. The resolver is pure; the loaders below
// wrap it with the queries.

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { reportAssignees, reportTemplates, teamMembers, teams } from "@/db/schema";

export interface AssignedPair {
  templateId: number;
  userId: number;
}

/** The rule, with all four inputs already loaded. Deduplicated. */
export function resolveAssignees(
  templates: { id: number; teamId: number }[],
  /** teamId → teams.template_mode */
  teamModes: Map<number, string>,
  explicit: AssignedPair[],
  members: { teamId: number; userId: number }[],
): AssignedPair[] {
  const explicitByTemplate = new Map<number, number[]>();
  for (const e of explicit) {
    const list = explicitByTemplate.get(e.templateId) ?? [];
    list.push(e.userId);
    explicitByTemplate.set(e.templateId, list);
  }
  const membersByTeam = new Map<number, number[]>();
  for (const m of members) {
    const list = membersByTeam.get(m.teamId) ?? [];
    list.push(m.userId);
    membersByTeam.set(m.teamId, list);
  }

  const out: AssignedPair[] = [];
  const seen = new Set<string>();
  for (const t of templates) {
    const userIds =
      teamModes.get(t.teamId) === "shared"
        ? (membersByTeam.get(t.teamId) ?? [])
        : (explicitByTemplate.get(t.id) ?? []);
    for (const userId of userIds) {
      const key = `${t.id}:${userId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ templateId: t.id, userId });
    }
  }
  return out;
}

/**
 * Effective assignees for the given templates. Pass template ids you have
 * already scoped to one org — this does not re-check tenancy.
 */
export async function loadAssignees(
  templateIds: number[],
): Promise<AssignedPair[]> {
  if (templateIds.length === 0) return [];

  const templateRows = await db
    .select({ id: reportTemplates.id, teamId: reportTemplates.teamId })
    .from(reportTemplates)
    .where(inArray(reportTemplates.id, templateIds));
  const withTeam = templateRows.filter(
    (t): t is { id: number; teamId: number } => t.teamId !== null,
  );
  if (withTeam.length === 0) return [];

  const teamIds = [...new Set(withTeam.map((t) => t.teamId))];
  const [teamRows, explicit, members] = await Promise.all([
    db
      .select({ id: teams.id, templateMode: teams.templateMode })
      .from(teams)
      .where(inArray(teams.id, teamIds)),
    db
      .select({
        templateId: reportAssignees.templateId,
        userId: reportAssignees.userId,
      })
      .from(reportAssignees)
      .where(inArray(reportAssignees.templateId, templateIds)),
    db
      .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, teamIds)),
  ]);

  return resolveAssignees(
    withTeam,
    new Map(teamRows.map((t) => [t.id, t.templateMode])),
    explicit,
    members,
  );
}

/**
 * The active templates a user is expected to file in this org — explicit
 * assignments plus every template of a `shared` team they belong to. Archived
 * templates and archived teams are excluded: an archived team stops accepting
 * reports (its roundup can't be generated), so its templates must not show up
 * as owed.
 */
export async function loadAssignedTemplateIds(
  orgId: number,
  userId: number,
): Promise<number[]> {
  const rows = await db
    .select({
      id: reportTemplates.id,
      templateMode: teams.templateMode,
      assigneeUserId: reportAssignees.userId,
      memberUserId: teamMembers.userId,
    })
    .from(reportTemplates)
    .innerJoin(teams, eq(reportTemplates.teamId, teams.id))
    .leftJoin(
      reportAssignees,
      and(
        eq(reportAssignees.templateId, reportTemplates.id),
        eq(reportAssignees.userId, userId),
      ),
    )
    .leftJoin(
      teamMembers,
      and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, userId)),
    )
    .where(
      and(
        eq(reportTemplates.orgId, orgId),
        isNull(reportTemplates.archivedAt),
        isNull(teams.archivedAt),
      ),
    );

  return [
    ...new Set(
      rows
        .filter((r) =>
          r.templateMode === "shared"
            ? r.memberUserId !== null
            : r.assigneeUserId !== null,
        )
        .map((r) => r.id),
    ),
  ];
}
