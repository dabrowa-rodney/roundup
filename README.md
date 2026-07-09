# Roundup

**Live at [www.roundup.work](https://www.roundup.work)** · owner console at [console.roundup.work](https://console.roundup.work)

Roundup is a multi-tenant SaaS platform that turns scattered weekly team
updates into one leadership summary. Each team lead files a short structured
update; Roundup folds in live metrics from connected Google Sheets and — with
AI enabled — writes the weekly **Roundup**: a punchy headline, exec summary,
risks, highlights, week-over-week changes and charts, delivered to senior
leadership by email.

**The weekly loop:**

1. Monday — the week opens; contributors get fresh report forms
2. Thu/Fri — automatic email reminders nudge anyone who hasn't submitted
3. Sunday 20:00 (configurable) — the week locks
4. An admin generates the Roundup (AI-written on paid plans, rule-compiled
   on Free), reviews the draft, and hits **Send to recipients**

## Who uses it

Roundup is organisation-based (self-serve signup). Within an org there are
three roles, managed on the Team page:

| Role | Can do |
|---|---|
| **Administrator** | Everything: templates, team, settings, billing, generate/send Roundups |
| **Contributor** | File their assigned weekly reports |
| **Recipient** | Receives the weekly Roundup email (admins always receive it too) |

Above all organisations sits the **owner console** (`console.roundup.work`,
gated by the `SUPER_ADMIN_EMAILS` env var): platform stats, a drill-down into
every org (editable settings, team, activity, plan), complimentary-access
grants, and discount-code management.

## Screens & features

**The app (`www.roundup.work`)**

- **Login** — Google sign-in or passwordless email magic links (single-use,
  15-min). New emails create an organisation via a short onboarding step
  (org name + workspace slug); invited emails land in their team.
- **My reports** — the contributor home: this week's report cards with
  status, plus previous submissions.
- **Report form** — the structured weekly update. Question types: RAG status,
  short/long text, single/multi choice, number (with unit), file/link.
  Autosaves; locks when the week closes.
- **Reports** (admin) — template manager: create/rename/edit area, add and
  drag-reorder questions, assign contributors, archive (reversible) or delete
  (7-day recovery window, then purged).
- **Team** (admin) — members with roles, assigned reports, last-signed-in
  (or "Invite pending" + resend). Invites email the invitee.
- **Data sources** (admin) — connect a public Google Sheet per template;
  live preview shows exactly which metrics will pull.
- **Roundups** (admin) — weekly list with status (Pending/Draft/Sent);
  generate, regenerate, and view.
- **Roundup viewer** — two modes: **Skim** (headline, needs-attention risks,
  what changed, highlights, key metric cards, trend charts, by-team lines)
  and **Full report** (exec summary, numbered risks, data appendix). A
  **Send to recipients** button distributes it by email.
- **Settings** — account; organisation (name, workspace URL); **AI
  generation** (included on paid plans via the platform's Anthropic account;
  optional BYO key override, stored encrypted); **Plan &
  billing** (tier cards, Stripe checkout, customer portal); weekly schedule
  (close/reopen day+time, London tz); reminder slots; roundup-ready
  notification toggle.

**The console (`console.roundup.work`, owner only)**

- Dashboard: org/member/activity totals, per-org table with plan badges
- Org detail: edit any org's settings, see team/templates/activity, remove a
  broken AI key, grant/revoke complimentary access
- Discounts: create/deactivate promotion codes (% off; once / N months /
  forever; optional expiry + max uses) — customers enter them at Stripe
  checkout

## How a Roundup is generated

Hybrid pipeline — **code owns the facts, AI writes the prose**:

- The deterministic compiler (`src/lib/roundup.ts`) computes everything
  countable: metrics from sheets + number answers, per-team RAG dots, report
  counts.
- If the org's plan includes AI, Claude writes the narrative using the
  platform `ANTHROPIC_API_KEY` (or the org's own key if they've connected one
  in Settings → AI generation)
  (`src/lib/roundup-ai.ts`): headline, exec summary, risk/highlight phrasing,
  per-team one-liners, week-over-week changes, and it picks up to 3 charts
  from the sheet series — chart data points are copied verbatim from the
  sheet, never model-generated. Structured output guarantees the JSON shape.
- No key / any failure → clean fallback to the deterministic output.
  Usage bills to the org's key, not ours.

## Plans & billing (Stripe)

| | Free | Team £29/mo · £290/yr | Business £79/mo · £790/yr |
|---|---|---|---|
| Members | 3 | 25 | Unlimited |
| Templates | 1 | Unlimited | Unlimited |
| AI Roundups | — | ✓ | ✓ |

Everything else (reminders, sheets, distribution, subdomain) is on every
tier. New orgs get a card-free **14-day Team trial**. Prices are
multi-currency (GBP default, USD auto-applied). Limits enforce at the
chokepoints: member invite, template create, AI generate. Stripe Checkout +
Customer Portal + a webhook keep `organisations.plan` in sync; discount codes
are Stripe promotion codes. The owner can grant `complimentary` (full access,
no subscription) from the console.

## Design system — Wonde 3.0

Canonical source: `https://skills.wonde.com/design/ds/` (fetch for full
tokens and guidance). In-repo: all tokens live as CSS custom properties in
`src/app/globals.css`; fonts self-hosted in `public/fonts`.

- **Type**: Gilroy (display/headings, `font-head`) + Inter (body)
- **Primary**: `#4368FA` (accent) on white; ink is blazer navy `#27325E`
- **Shape language**: 16px-radius cards (`rounded-card`), pill buttons,
  soft tinted status badges (`good/warn/bad` + `-soft` background variants)
- **Icon**: rounded-square "R" mark (`public/roundup-icon.svg`, white variant
  for dark backgrounds); Wonde wordmark appears on the login page
- **Emails** share the palette: table-based layout, white card on `#F4F6FB`,
  pill CTA button (`src/lib/email.ts`)

## Stack & architecture

- **Next.js 16** (App Router; `src/proxy.ts` for host routing) · React 19 ·
  TypeScript · Tailwind v4
- **NextAuth v4** — Google OAuth + custom magic-link credentials provider;
  session cookie scoped to `.roundup.work` (shared across subdomains)
- **Drizzle ORM + Neon Postgres** — every tenant table carries `org_id`; all
  reads/writes resolve the org from the session (`src/lib/session.ts`),
  never from client input
- **Resend** for all email (domain `notifications.roundup.work`)
- **Stripe** for subscriptions (`scripts/stripe-setup.mjs` bootstraps
  products/prices/webhook)
- **Anthropic API** for AI generation (platform key; optional per-org
  override keys, AES-256-GCM at rest)
- **Vercel** — deploy on push to `master`; Vercel DNS hosts `roundup.work`
  (wildcard `*.roundup.work` ready for per-org subdomains); two daily crons:
  lifecycle (lock/open weeks, purge deleted templates) and reminders
- **Vitest** — `npm test` (80+ tests: date/tz math, lifecycle, compiler,
  AI merge rules, crypto, slugs, plans, email templates)

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | Sessions + canonical URL |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email sending |
| `ENCRYPTION_SECRET` | AES key for org secrets (BYO Anthropic keys) |
| `ANTHROPIC_API_KEY` | Platform key powering AI Roundups on paid plans |
| `SUPER_ADMIN_EMAILS` | Comma-separated owner-console access |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `CRON_SECRET` | Authorises Vercel cron calls |
| `APP_URL` | *(optional)* absolute URL for email links |

Every integration degrades gracefully when its key is missing (no email →
silent no-op; no AI key → deterministic Roundups; no Stripe → billing card
shows "coming soon").

## Getting started (local)

```bash
npm install          # Node 20+ (a local runtime lives at ~/.local/node-runtime)
npm run dev          # http://localhost:3000  (or ./dev-server.sh)
npm test             # Vitest unit suite
npm run lint
```

Database schema: `src/db/schema.ts`; full bootstrap `drizzle/reset.sql`
(destructive); incremental migrations `drizzle/000*.sql` (run against Neon
manually). Health check: `GET /api/health`.

## Project structure

```
src/
  proxy.ts                # host routing (console.roundup.work → /console)
  app/
    login/ onboarding/ auth/verify/   # signup + sign-in surfaces
    (app)/                # authenticated app shell (sidebar + screens)
      my-reports/ reports/ team/ roundups/ data-sources/ settings/
    console/              # owner console (+ orgs/[id], discounts)
    api/                  # org-scoped routes, billing, stripe webhook, crons
  components/             # screen UIs (client components)
  db/                     # Drizzle client + schema
  lib/                    # auth, session, plans, stripe, email, crypto,
                          # roundup compiler + AI, sheets, lifecycle, dates
drizzle/                  # reset.sql + numbered migrations
scripts/stripe-setup.mjs  # idempotent Stripe bootstrap
```

## Roadmap

- **Per-org subdomains** (`acme.roundup.work`) — DNS + shared session cookie
  done; host-routing middleware next
- **Custom domains** (`roundup.acme.com`) — Business tier; central-login handoff
- Private Google Sheets via service account
