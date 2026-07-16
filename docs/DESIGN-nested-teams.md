# Design — Nested Teams & Cascading Roundups

> **Status:** Implemented (stages 1–6 on this branch), with one deliberate
> exception: **D3 (team leads managing their own subtree) is not yet built** —
> all structure/generation actions are org-admin-only for now; the per-team
> lead role is stored and distributed to, ready for the permission expansion
> as a follow-up. Run `drizzle/0007_teams.sql` before deploying.
> Companion to `docs/ARCHITECTURE.md` (the current system).

## 1. Goal

Let an organisation model its real structure — teams inside teams, to any depth
— so reports cascade upward:

- Individuals file weekly reports.
- A **team lead** gets a roundup of *their* team.
- That lead's **line manager** (who owns the parent team, covering several
  teams) gets a roundup covering the teams they manage — built from the child
  teams' roundups and/or the underlying individual reports.
- This repeats up every level of the tree.
- Cadence lengthens up the tree: weekly at the bottom, **monthly / quarterly**
  higher up.

## 2. Confirmed decisions (from product review)

| # | Decision | Choice |
|---|---|---|
| 1 | **Roll-up inputs** — what a parent roundup summarises | **Configurable per team**: members' individual reports, OR child-team roundups + each child lead's own report, OR both |
| 2 | **Membership & lead role** | **Multi-team, per-team role** — a person can be in several teams, and lead one while being a member of another |
| 3 | **Template assignment** | **Per-team choice** — each team decides between one shared template for all members, or per-member assignments |
| 4 | **Cadence scope** | **Everything in v1** — team tree + weekly roll-up + monthly/quarterly aggregation ship together |

## 3. Open decisions (my recommended defaults — please confirm or redirect)

These follow directly from the choices above and each nudges the data model or
pipeline. Defaults chosen to keep the model coherent and the UI teachable.

- **D1 — Report contribution follows the *template's* team, not raw membership.**
  A user's report is tied to the team that owns the template they filled. So a
  person in two teams (each with its own report) files two reports, one per
  team; multi-team membership governs *roles, visibility and recipients*, not
  which roundup a given report feeds. **Why:** avoids the ambiguity of "a person
  in 3 teams — which roundup does their single report count toward?" and keeps
  roll-up unambiguous. *Alternative: a single report fans out to every team the
  person belongs to (noisier, ambiguous).*

- **D2 — A parent consumes its children's *sent* (approved) roundups**, falling
  back to the latest draft only if none is sent for the window. **Why:** avoids
  summarising unreviewed drafts up the chain; the lead's review gate still
  means something. *Alternative: always use the latest generated content
  regardless of approval (faster, less controlled).*

- **D3 — Team leads can manage their own subtree** (create sub-teams, add/move
  members, generate & send their team's roundup); org admins can do anything
  anywhere. **Why:** delegates org-building to the people who know their teams;
  matches how the hierarchy is used. *Alternative: admin-only structure editing
  (simpler permissions, bottleneck for big orgs).*

- **D4 — Calendar-aligned periods in the org timezone.** Weekly = Monday start
  (as today); monthly = 1st of the calendar month; quarterly = calendar quarter
  (Jan/Apr/Jul/Oct). A monthly parent rolls up the child roundups / reports
  whose period falls inside that month. *Alternative: rolling N-week windows.*

- **D5 — Nested teams are a Business-tier feature.** Free/Team keep the current
  flat model (their org is a single root team); Business unlocks sub-teams and
  monthly/quarterly cadences. Member/template limits may need revisiting. *To
  confirm — this is a pricing call as much as a technical one.*

- **D6 — Global `recipient` role dissolves into per-roundup recipients.** With
  distribution now per-team-per-period, a "recipient" is anyone selected on a
  given roundup (default: the team lead + the parent team's lead). Pure
  recipients (senior leaders who file nothing) are still supported via explicit
  selection. *Alternative: keep a global recipient role too (redundant).*

## 4. Data model changes

New and changed tables (all still org-scoped — the tenancy invariant is
untouched).

### New: `teams`
```
id            serial pk
org_id        fk organisations         -- tenancy
parent_team_id fk teams (nullable)     -- self-referential tree; null = root
name          text
cadence       text  -- 'weekly' | 'monthly' | 'quarterly'
rollup_mode   text  -- 'members' | 'children' | 'both'   (decision #1)
template_mode text  -- 'shared'  | 'per_member'          (decision #3)
archived_at   timestamp (nullable)     -- soft delete, subtree-aware
created_at    timestamp
```
One **root team per org** (created on migration) so existing flat orgs keep
working. Depth is unbounded; we guard against cycles on write.

### New: `team_members` (many-to-many — decision #2)
```
id       serial pk
team_id  fk teams
user_id  fk users
role     text  -- 'lead' | 'member'   (multiple leads allowed)
unique(team_id, user_id)
```
"Team lead" lives here, per team — not on the global user row.

### Changed: `report_templates`
- add `team_id fk teams` — the owning team.
- `template_mode = 'shared'` ⇒ every current team member is implicitly assigned;
  `'per_member'` ⇒ explicit `report_assignees` as today (scoped within the team).

### Changed: `roundups`
- add `team_id fk teams`, `period_type text` ('week'|'month'|'quarter'),
  `period_start date`.
- replace the `unique(org_id, week_start)` key with
  **`unique(team_id, period_type, period_start)`**. There are now many roundups
  — one per team per period.
- keep `org_id` for scoping and cheap org-wide queries.

### Unchanged in shape (semantics extended)
- `report_instances` (template × user × period) — team is derived via
  `template.team_id` (decision #1). Period key generalises from `week_start` to
  the template team's cadence.
- `answers`, `roundup_recipients` — unchanged; there are just more of them.
- `settings` — org-level schedule stays as the default; per-team cadence lives
  on `teams`. Reminder slots may move to per-team later (phase-tail).

## 5. Roles & permissions

| Actor | Scope | Can do |
|---|---|---|
| **Org admin** (`users.role='admin'`) | whole org | Everything: billing, templates, full team tree, any roundup |
| **Team lead** (`team_members.role='lead'`) | their team + descendants | Manage subtree (per D3), assign members, generate/send their team's roundup, view descendant reports/roundups |
| **Member** (`team_members.role='member'`) | their team | File their own reports; read their team's *sent* roundup |
| **Recipient** (per-roundup) | one roundup | Read a specific sent roundup (may file nothing) |

`getSessionUser()` stays the single source of identity; a new
`getTeamRole(user, teamId)` (walks membership + admin override) gates
team-scoped actions. **No org id or team id is ever trusted from the client** —
the core invariant is preserved.

## 6. Generation pipeline & lifecycle

### Roll-up (bottom-up)
Generation is **leaf-first**. For a team's roundup at period P, gather inputs by
`rollup_mode`:
- `members` → the team's members' report instances submitted for P.
- `children` → each child team's roundup for the window inside P (per D2:
  prefer sent), plus each child lead's own report.
- `both` → union of the two.

The compiler (`src/lib/roundup.ts`) and AI step (`src/lib/roundup-ai.ts`) gain a
**"summarise summaries" mode**: when inputs are child roundups rather than raw
answers, facts (metrics, RAG dots, counts) are aggregated from the children's
structured JSON — never re-derived by the model — preserving the *code-owns-
facts* invariant. Chart data still comes verbatim from sheets.

### Periods & scheduling
- Each team's cadence defines its period open/lock (calendar-aligned, D4).
- The **lifecycle cron** extends from "open/lock the org's week" to "for each
  team, open/lock the current period for its cadence." Weekly teams still turn
  over weekly; monthly/quarterly teams turn over on calendar boundaries.
- **Generation stays a deliberate action** (a lead/admin clicks *Generate*, as
  today) — the cron manages period state, not auto-generation. Auto-generate on
  lock can be a follow-up toggle.
- A parent monthly roundup for, say, March rolls up the child roundups whose
  period_start falls in March.

### Invariant preservation
- AI never supplies numbers/dots/chart points (now also true when summarising
  child roundups — facts aggregate from child JSON).
- `generateRoundupAI` stays total-fallback; the 55s < 60s timeout budget still
  holds, but note deep trees mean **many** generations — see Risks.

## 7. Distribution

Per-roundup recipients (`roundup_recipients`), with **tree-derived defaults**:
a team's roundup is offered to its lead(s) + the parent team's lead(s), plus any
explicitly added people. The send flow (`api/roundups/send`) is unchanged in
spirit but now targets a specific team-period roundup. The Roundups UI gains a
recipient picker per roundup (decision #6).

## 8. Migration (backward-compatible)

1. Create one **root team** per org; set cadence=weekly, rollup_mode=members,
   template_mode=per_member (matches today).
2. Add all users as `team_members` of the root team; map `role='admin'`→lead,
   others→member.
3. Set `template.team_id = root` for every existing template; preserve existing
   `report_assignees`.
4. Backfill `roundups.team_id = root`, `period_type='week'`,
   `period_start = week_start`; swap the unique key.
5. Existing behaviour is now "a one-team tree" — no user-visible change until an
   admin starts adding sub-teams. Free/Team tiers stay here (D5).

Migration ships as a numbered `drizzle/000X_*.sql` plus a data backfill, run the
same way as prior migrations.

## 9. UI / UX changes

- **People / Team → Team builder.** A tree view: create/nest/rename/archive
  teams, drag members between teams, assign leads, set each team's cadence /
  rollup_mode / template_mode. This is the biggest new surface.
- **Reports → grouped by team.** Template manager scoped per team; "shared vs
  per-member" toggle per team.
- **My reports.** Largely unchanged; a member with reports in multiple teams
  sees them grouped by team.
- **Roundups → tree + filters.** With many roundups, the list gets a team
  selector + period filter and a tree breadcrumb; the viewer shows team + period
  context and "what fed this" (which child roundups / reports). Per-roundup
  recipient picker with tree-derived defaults.
- **Settings.** Org-wide defaults stay; per-team config moves onto team detail.

## 10. Plan & billing

Per D5, gate sub-teams + monthly/quarterly on **Business**. Revisit the
member/template limit model (a deep org has many templates by construction).
Enforcement stays at the existing chokepoints plus a new "create sub-team" one.

## 11. Build plan (single release, staged internally)

Even shipping everything at once, build and verify in this order behind a flag:

1. **Data model + migration** — teams, team_members, template.team_id, roundups
   columns; backfill; root-team compatibility. Tests green, no UI change.
2. **Roll-up pipeline** — extend compiler + AI for team/period + the three
   rollup_modes + summarise-summaries; bottom-up generation ordering.
3. **Lifecycle** — per-team cadence open/lock; monthly/quarterly periods.
4. **Distribution** — per-roundup recipients + tree-derived defaults.
5. **UI** — team builder, grouped reports, roundups tree/filter, recipient
   picker.
6. **Plan gating, polish, test hardening.**

Each stage keeps the app shippable (root-team behaviour unchanged until teams
are used).

## 12. Risks & things to watch

- **Generation fan-out / cost.** A 4-level org generates roundups at every node;
  bottom-up + the per-call Anthropic budget means latency and token spend scale
  with tree size. Likely need batched/queued generation, not one 60s request.
- **Cycle / depth safety.** Enforce acyclic writes and a sane max depth.
- **Summarising summaries drift.** Facts must aggregate from child JSON, never
  the model — needs explicit tests mirroring the existing chart-verbatim tests.
- **Config overwhelm.** Flexibility (D1/D2/D3 per team) is powerful but can
  bewilder; lean on defaults and inheritance from the parent team.
- **Permissions surface.** Team-scoped roles are a real expansion of the
  security model; `getTeamRole` needs thorough tests.
