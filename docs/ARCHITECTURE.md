# Roundup — Architecture & Maintainer Guide

> Orientation doc for anyone (human or agent) picking up this codebase in a
> fresh checkout. The `README.md` is the product brief; this is the map of how
> the code actually fits together and the invariants you must not break.
>
> **First, read `AGENTS.md`.** This is a *modified* Next.js with breaking
> changes from stock — consult `node_modules/next/dist/docs/` before editing
> routes or pages, not your training-data assumptions.

## The system in one breath

Multi-tenant SaaS. Contributors file structured weekly reports → a hybrid
pipeline (code computes the facts, Claude writes the prose) compiles a
leadership **Roundup** → an admin reviews the draft and emails it to
recipients. Everything is **org-scoped**: the current org and role are always
resolved server-side from the signed-in email via `getSessionUser()`
(`src/lib/session.ts`) — **never** from client input. That single rule is the
backbone of tenant isolation.

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript · Tailwind v4
- **NextAuth v4** — Google OAuth + a custom magic-link credentials provider
- **Drizzle ORM + Neon Postgres** — every tenant table carries `org_id`
- **Resend** — all transactional email (`notifications.roundup.work`)
- **Stripe** — subscriptions + promotion codes
- **Anthropic API** (`@anthropic-ai/sdk`) — AI Roundup generation
- **Vercel** — deploy on push to `master`; two daily crons

## Data model (`src/db/schema.ts`)

```
organisations (tenant: plan, planStatus, stripeCustomerId, trialEndsAt,
               anthropicKeyEnc [AES-256-GCM])
  └─ users (role: admin | contributor | recipient; email globally unique)
  └─ teams (self-referential tree via parentTeamId; ONE root per org —
       │    partial unique index; cadence weekly|monthly|quarterly;
       │    rollupMode members|children|both; templateMode shared|per_member)
       └─ teamMembers (team ↔ user; role 'lead'|'member' is PER TEAM)
  └─ reportTemplates (belongs to a team via teamId; soft-delete: archivedAt;
       │              deletedAt starts 7-day purge)
       └─ questions (type: rag|short_text|long_text|single_choice|
       │             multi_choice|number|file_link; config jsonb)
       └─ reportAssignees (template ↔ user)
       └─ reportInstances (one per template×user×period; weekStart carries
            │               the period's first day; status: not_started|
            │               in_progress|submitted|locked)
            └─ answers (value jsonb, typed by question; unique per instance×question)
  └─ roundups (status: pending|draft|sent; skimJson/fullJson;
       │       ONE PER TEAM PER PERIOD — unique(teamId, periodType,
       │       periodStart); weekStart mirrors periodStart)
       └─ roundupRecipients (per-roundup audience; final once sent)
  └─ settings (schedule + reminder slots; one row per org)
  └─ emailLog (kind × weekStart idempotency ledger; team-scoped kinds
               'roundup_sent:t<id>' for sub-team sends)
loginTokens (magic-link: SHA-256 hash only, 15-min, single-use)
```

**Conventions:** `weekStart`/`periodStart` are `YYYY-MM-DD` strings of the
period's first day — the Monday for weeks, the 1st for calendar months, and
Jan/Apr/Jul/Oct 1st for quarters (`src/lib/dates.ts` owns the math).
Soft-deletes everywhere — historical answers are never hard-deleted so they
remain context for future Roundups. A `deletedAt` template always also has
`archivedAt` set, so `isNull(archivedAt)` queries exclude deleted templates
by construction.

### The team tree & roll-up (docs/DESIGN-nested-teams.md)

Every org is a tree of teams; flat orgs are simply "a one-team tree" (the
root team, created by migration 0007 or on signup — behaviour is unchanged
until sub-teams exist). Reports roll UP the tree:

- A report contributes to **its template's team** (D1); multi-team
  membership governs roles/visibility, not report routing. Assigning a person
  to a report also adds them to that report's team (additive — unassigning
  doesn't remove them), so "who fills a report" and "who's on the team" stay
  in sync. Team membership is also managed directly on the Team page (People
  list + invite/edit picker) and in the structure tree.
- A team's roundup is generated at **its cadence** (weekly/monthly/quarterly,
  calendar-aligned) from inputs chosen by its `rollupMode`: its members'
  reports, its children's roundups + child leads' reports, or both.
  A parent consumes a child's **sent** roundups for the window, falling back
  to the latest draft (D2, `selectChildRows`).
- **Summarise-summaries invariant:** when inputs are child roundups, facts
  (worst-RAG dots, risks, highlights, metric cards) aggregate from the
  children's stored JSON in `compileRoundup` — never re-derived by the
  model. Child charts are not rolled up.
- Tree safety lives in `src/lib/teams.ts`: `wouldCreateCycle`,
  `MAX_TEAM_DEPTH` (8), subtree walks — the DB does not enforce acyclicity.
- Nested teams + non-weekly cadences are **Business-tier** (D5), gated at
  sub-team creation and cadence change.

### Team authority (D3) — `src/lib/team-authority.ts`

Who may do what to a team is a **pure function of the tree**, kept separate
from the DB so it is exhaustively testable (`team-authority.test.ts`).
`getTeamAuthority(orgId, userId, orgRole)` in `lib/teams.ts` loads the org's
live teams plus the caller's `lead` memberships and hands them to
`teamAuthority()`, which returns `{ isOrgAdmin, leadTeamIds, managedTeamIds }`
— `managedTeamIds` being the union of the subtrees rooted at the teams the
caller leads (every team, for an org admin).

- `canManageTeam` — configure a team, staff it, drive its Roundups. True for
  anything in `managedTeamIds`.
- `canCreateSubTeam(parentId)` — nest below a team you manage.
- `canArchiveTeam` — manage, **but never your own lead team**: a lead cannot
  delete the mandate their authority derives from. Its parent's lead or an
  admin can.
- `canMoveTeam(id, newParentId)` — both ends must be managed, and again not
  your own lead team, so a subtree can never be relocated out of (or into)
  someone else's reach.

Two rules the routes must preserve: authority is checked **against the
resolved row, after org scoping**, so a foreign id keeps returning 404 rather
than confirming itself with a 403; and appointing a co-lead is deliberately
allowed, because it only shares a subtree the caller already manages. Note
that `getTeamAuthority` builds the tree from **non-archived** teams, so
restoring an archived team is effectively admin-only.

## Subsystems

### Auth & multi-tenancy — `src/lib/{auth,session,magic-link,org,crypto}.ts`, `src/proxy.ts`
- Two sign-in paths: **Google OAuth** and **passwordless magic links**. A
  magic link stores only the SHA-256 hash of the token; the raw token lives
  only in the emailed URL, expires in 15 minutes, and is single-use (consumed
  atomically).
- `signIn` **never creates a user row.** First-time emails are routed to
  `/onboarding`, which creates an organisation (caller becomes `admin`, gets a
  card-free 14-day Team trial). Invited emails already have a row and simply
  land in their org.
- **`getSessionUser()` (`src/lib/session.ts`) is the one true entry point** for
  "who is calling and what org are they in." Every API route and server
  component resolves `orgId`/`role` through it. Any code that reads an org id
  from the client breaks the security model.
- The session cookie is scoped to `.roundup.work` so it is shared across
  subdomains. `src/proxy.ts` handles host routing (`console.roundup.work` →
  `/console`; wildcard `*.roundup.work` reserved for per-org subdomains).
- Owner console access = `isSuperAdmin(email)` against `SUPER_ADMIN_EMAILS`
  (`src/lib/super-admin.ts`). Console pages **self-gate** — there is no
  `middleware.ts`.
- Org Anthropic keys are encrypted at rest with AES-256-GCM
  (`src/lib/crypto.ts`, `ENCRYPTION_SECRET`). The key is write-only through the
  API — never returned to the client.

### Weekly lifecycle & crons — `src/lib/{lifecycle,dates}.ts`, `src/app/api/cron/*`, `vercel.json`
- Whether a week is open/locked is **derived** from the org's configured London
  wall-clock schedule at request time — correct even if the cron runs late.
- Two daily Vercel crons:
  - **`lifecycle`** — lock past-close weeks, open the current week for
    assignees (get-or-create instances), purge templates soft-deleted >7 days.
  - **`reminders`** — email contributors who have not yet submitted.
- Both authorize via `Bearer $CRON_SECRET` (acts on all orgs) **or** an admin
  session (own org only). Both set `maxDuration = 60`.

### Email — `src/lib/email.ts` (Resend)
- Table-based "bulletproof" HTML shell (survives Outlook / CSS-stripping
  clients). Kinds: `reminder1`, `reminder2`, `roundup_ready`, `roundup_sent`,
  plus invites and magic links.
- **Never throws**; a missing `RESEND_API_KEY` is a silent no-op.
- Idempotency is enforced by the `emailLog (orgId, kind, weekStart)` unique key
  + `onConflictDoNothing` — however often a cron endpoint is hit, each slot
  fires at most once per week.

### Generation pipeline — `src/lib/{roundup,roundup-ai,sheets}.ts`, `src/app/api/roundups/*`
The core of the product: **code owns the facts, AI writes the prose.**
- **`compileRoundup` (`src/lib/roundup.ts`)** is the deterministic compiler. It
  infers structure from question *type* (rag → RAG dot/severity; number → key
  metric; long_text matching a risk/win regex → risks/highlights) and produces
  the authoritative `SkimJson`/`FullJson` skeleton: metrics, per-team RAG dots,
  report counts, dates, titles.
- **`generateRoundupAI` (`src/lib/roundup-ai.ts`)** overlays AI prose on top of
  that skeleton. It calls `claude-opus-4-8` with adaptive extended thinking and
  schema-constrained output (`output_config.format = json_schema`), a 55s
  client timeout (deliberately under the route's 60s cap), and merges only the
  narrative fields (headline, exec summary, risk/highlight/change phrasing,
  per-team one-liners). **It never throws** — a missing key, a refusal, a
  timeout, or a parse error all fall back to `compileRoundup` output.
- **`src/lib/sheets.ts`** ingests a *public* Google Sheet (only
  `docs.google.com` CSV-export URLs are ever fetched — this is the SSRF guard).
  Column 0 is the period label; each other column is a metric series. Metrics
  need ≥2 non-empty rows; chart series need ≥3 numeric points.
- **Generate → send lifecycle** (`roundups.status`): `pending` → `draft`
  (generate/regenerate) → `sent` (send, one-shot). Both need `canManageTeam` on
  the owning team, so a team lead drives their own subtree's Roundups.
  Generate refuses an empty week (409). Send records recipients, emails
  `recipient`- and `admin`-role users, and marks sent.
- **AI key selection** happens in the generate route, not in `roundup-ai.ts`:
  if the plan includes AI, use the org's decrypted BYO key, else the platform
  `ANTHROPIC_API_KEY`; if the plan has no AI entitlement, no key (deterministic).

### Codes, limits & abuse guards
- **Discount codes** live in Stripe (promotion codes, minted in the console).
  **Complimentary codes** are Roundup-internal (`complimentary_codes`): each
  grants `months` of full free access. Both are redeemed from one box on
  Settings → Plan & billing (`api/billing/redeem`).
- `complimentary_redemptions` has `UNIQUE(code_id, org_id)`: that key — not a
  counter — is what stops an org redeeming a code twice, and it's the audit
  trail of who granted themselves what. Redemption is also refused while a
  grant is already live (no stacking) and while a Stripe subscription is
  active (they'd be charged for something free).
- **Rate limiting** (`lib/rate-limit.ts`) is DB-backed on purpose: serverless
  instances share no memory, so an in-process counter is bypassed by landing
  on a cold instance. Fixed windows, one atomic upsert per check; it **fails
  open** because it guards already-authorised callers. The lifecycle cron
  sweeps old windows.
- **Grandfathering policy (deliberate):** plan limits are enforced when
  something is **created** — invite, template, sub-team, cadence change.
  Nothing already built is switched off when a plan lapses; tearing down a
  customer's live reporting structure mid-week would destroy real work. The
  trade-off is that a lapsed org can sit above its plan, so the rule is
  *grandfather it but say so* — `overPlanFeatures()` produces the list and the
  billing card shows it.

### Plans & billing — `src/lib/{plans,org-plan,stripe}.ts`, `src/app/api/billing/*`, `src/app/api/stripe/webhook`
- Tiers: **free** (3 members / 1 template / no AI), **team** (25 / ∞ / AI),
  **business** (∞), **complimentary** (owner-granted, business-equivalent, no
  subscription).
- Limits are enforced at three chokepoints: **member invite**, **template
  create**, **AI generate**.
- The 14-day trial is purely time-based via `trialEndsAt` (no scheduled job).
- Stripe Checkout + Customer Portal + a signature-verified webhook keep
  `organisations.plan` / `planStatus` in sync. Discount codes are Stripe
  promotion codes, managed from the console. Prices are multi-currency
  (GBP default, USD auto-applied) on shared lookup keys. `scripts/stripe-setup.mjs`
  idempotently bootstraps products/prices/webhook.
- Every billing route 503s gracefully when Stripe env is unset.

### App & console — `src/app/(app)/*`, `src/app/console/*`, `src/components/*`
- The authenticated shell (`src/app/(app)/layout.tsx`) redirects no-session →
  `/login`, session-but-no-row → `/onboarding`, then splits by authority:
  **org admins and team leads** get the `Sidebar`; plain
  **contributors/recipients** get the slim `Topbar`. A lead's sidebar drops the
  org-wide config areas (Reports, Data sources) and keeps Team + Roundups.
- Screens follow the same per-team rights as the API (see "Team authority"):
  `/team` admits admins and leads — admins additionally get the People roster,
  and the tree renders each team's controls from the server-supplied
  `canManage`/`canArchive`, with move targets limited to teams the caller also
  manages. `/roundups` lists only teams the caller manages (that set is also the
  `?team=` allow-list) and `/roundups/[week]` shows generate/send only when the
  resolved team is theirs, so a lead who lands on the org-wide Roundup reads it
  like a recipient. A recipient who also leads a team gets both: the management
  tables plus their "Sent to you" list.
- Role home routing: recipients → `/roundups`, everyone else → `/my-reports`
  (mirrored in `src/app/page.tsx` and `src/components/topbar.tsx`).
- List/read pages are **server components** querying Drizzle directly; mutation
  screens (reports manager, team, settings, data sources, console detail) are
  **client components** that `fetch` and then `router.refresh()` or re-fetch.
- The report form autosaves with an 800ms debounce (`src/components/report-form.tsx`),
  disabled once the week locks. A "Nothing this week" skip uses a sentinel value
  and is excluded from Roundup generation.

## API surface (`src/app/api/*`)

| Route | Methods | Purpose | Auth |
|---|---|---|---|
| `auth/[...nextauth]` | GET/POST | NextAuth (Google + email) | public |
| `auth/email` | POST | request magic link (no account enumeration) | public |
| `auth/signout-complete` | GET | expire all cookie variants, → `/login` | public |
| `orgs` | POST | self-serve signup (create org, become admin) | session, no membership |
| `org` | GET/PATCH | org + billing (GET, any member); update name/slug/AI key (PATCH, admin) | mixed |
| `settings` | GET/PATCH | schedule + reminders | GET member / PATCH admin |
| `users` | GET | members + areas + role stats | member |
| `users/invite` | POST | pre-create a member (invite) | admin |
| `users/[id]` | PATCH/DELETE | edit role/name; remove (guards last admin) | admin |
| `users/[id]/invite` | POST | resend invite | admin |
| `users/[id]/teams` | PUT | set a user's team memberships (409 if it would leave a sub-team leaderless) | admin |
| `teams` | GET/POST | org team tree w/ members (each carries `canManage`); create sub-team (Business) | GET member / POST `canCreateSubTeam` |
| `teams/[id]` | PATCH | rename, re-parent (cycle/depth guards), configure, archive/restore (subtree) | `canManageTeam`, + `canArchiveTeam` / `canMoveTeam` |
| `teams/[id]/members` | POST/DELETE | add/re-role ('lead'\|'member'); remove. 409 on giving up your own lead role, or on stripping a sub-team's last lead | `canManageTeam` |
| `templates` | GET/POST | list w/ counts; create (optional org-validated teamId) | GET member / POST admin |
| `templates/[id]` | PATCH/DELETE | update/restore/move team; soft-delete | admin |
| `templates/[id]/questions` | GET/POST/PATCH | list; add; update/archive | GET member / write admin |
| `instances/[id]` | PATCH | autosave/submit answers | owner only, rejects when locked |
| `roundups/generate` | POST | compile a team-period draft (AI + deterministic fallback); optional teamId, root default | `canManageTeam`, maxDuration 60 |
| `roundups/send` | POST | publish + email recipients (one-shot); optional teamId | `canManageTeam`, maxDuration 60 |
| `roundups/[id]/recipients` | GET/PUT | explicit per-roundup audience + tree-derived defaults; final once sent | `canManageTeam` on the owning team |
| `sheets/preview` | GET | preview a sheet's metrics | admin (docs.google.com only) |
| `billing/checkout` | POST | Stripe Checkout URL | admin (503 if unconfigured) |
| `billing/portal` | POST | Stripe Customer Portal | admin (needs customer) |
| `console/discounts` | GET/POST/PATCH | Stripe promotion codes | super-admin |
| `console/orgs/[id]` | PATCH | owner edits to any org | super-admin |
| `cron/lifecycle` | GET | lock/open weeks, purge templates | `Bearer CRON_SECRET` or admin |
| `cron/reminders` | GET | email non-submitters | `Bearer CRON_SECRET` or admin |
| `stripe/webhook` | POST | sync plan/planStatus | Stripe signature |
| `health` | GET | liveness + DB connectivity | public |

## Invariants — do not break these

1. **Org/role always come from `getSessionUser()`**, never from client input.
   Team ids from the client are always re-validated against the caller's org.
2. **The AI never supplies numbers, RAG dots, or chart data** — only prose.
   Chart points are copied verbatim from sheet series; unknown chart labels are
   dropped. This extends to roll-ups: parent facts aggregate from child
   roundup JSON in code. (Enforced by `roundup-ai.test.ts` / `roundup.test.ts`.)
3. **The AI path must stay total-fallback** — `generateRoundupAI` never throws,
   and the 55s client timeout must stay strictly under the 60s route cap. A
   broken AI path degrades silently to deterministic output, so verify the SDK
   request/response shape after any `@anthropic-ai/sdk` or model change.
4. **Email and instance idempotency rely on unique keys + `onConflictDoNothing`**,
   not application locks.
5. **This is a modified Next.js.** `params` is a `Promise` (await it); there is
   no `middleware.ts`; read `node_modules/next/dist/docs/` before changing
   routes or pages.
6. **Team authority is derived, never asserted.** Route handlers ask
   `lib/team-authority.ts` (via `getTeamAuthority`) instead of comparing roles
   inline, and only after the target row has been org-scoped — see "Team
   authority (D3)".
7. **Untrusted free-text** (contributor answers, sheet cells) is interpolated
   into the AI prompt. Injection can at worst distort prose — facts, dots, and
   chart data are code/sheet-sourced and schema-constrained — but treat
   generated prose as attacker-influenceable.

## Environment variables

See `README.md` for the full table. Every integration degrades gracefully when
its key is missing: no email key → silent no-op; no AI key → deterministic
Roundups; no Stripe → billing shows "coming soon".

## Working on the codebase

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest (85+ unit tests: dates/tz, lifecycle, compiler,
                 #         AI merge rules, crypto, plans, email, sheets)
npm run lint
npx tsc --noEmit # typecheck
npm run db:generate | db:push | db:studio   # drizzle-kit
```

Tests are the fast feedback loop and cover the tricky logic (date/tz math,
lifecycle transitions, the compiler, AI merge rules, sheet parsing). Run them
before and after any change to `src/lib/*`.
