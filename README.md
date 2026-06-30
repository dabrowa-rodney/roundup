# Roundup

Internal weekly-update platform. Team leads file a short structured update each
week; an admin folds in supporting data (Google Sheets); an AI step produces a
weekly **Roundup** summary (Skim + Full) for the senior leadership team.

This repo combines the recreated **UI** (all ten screens from the design handoff)
with the **backend foundation**: Google authentication, a Postgres database
(Neon) via Drizzle ORM, and the full Roundup data model. Domain screens still
render mock data — wiring them to live queries is the next phase (see
[Roadmap](#roadmap)).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — theme tokens as CSS custom properties (`src/app/globals.css`)
- **NextAuth v4** with the **Google** provider (upserts users; attaches `role` to the session)
- **Drizzle ORM** + **Neon** serverless Postgres
- **lucide-react** icons; **Plus Jakarta Sans** + **Space Grotesk** fonts

## Environment variables

Set these in Vercel (and in `.env.local` for local dev):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `NEXTAUTH_SECRET` | NextAuth session encryption secret |
| `NEXTAUTH_URL` | Canonical app URL (e.g. `https://your-app.vercel.app`) |
| `ADMIN_EMAILS` | *(optional)* comma-separated admin emails. The first user to sign in is made an admin automatically. |

The Google OAuth client's **Authorized redirect URI** must include
`{NEXTAUTH_URL}/api/auth/callback/google`.

## Getting started

> **Node:** targets Node 20+ (developed against Node 24 LTS). If you don't have a
> system Node, a local copy was installed at `~/.local/node-runtime/`; `dev-server.sh`
> puts it on `PATH`.

```bash
npm install
npm run dev          # http://localhost:3000  (or ./dev-server.sh)
npm run build        # production build
npm run db:generate  # regenerate Drizzle migration from src/db/schema.ts
npm run db:push      # sync schema to the database (interactive)
```

## Database

The schema lives in [`src/db/schema.ts`](src/db/schema.ts) — `users`,
`report_templates`, `report_assignees`, `questions`, `report_instances`,
`answers`, `roundups`, `roundup_recipients`, `settings`. Historical responses are
never hard-deleted: `archived_at` columns implement the soft-delete semantics
from the handoff.

To reset the database to a clean Roundup schema (drops the legacy scaffold tables
**and all data**):

```bash
psql "$DATABASE_URL" -f drizzle/reset.sql
# …or paste drizzle/reset.sql into the Neon SQL editor.
```

## Auth flow

`/login` → "Continue with Google" → NextAuth Google OAuth → user upserted into
Neon → redirected to `/my-reports`. The whole app shell (`src/app/(app)/`) is
gated server-side; unauthenticated requests redirect to `/login`. The first user
to sign in (or any address in `ADMIN_EMAILS`) becomes an administrator and sees
the ADMIN navigation.

## Project structure

```
src/
  app/
    layout.tsx            # root: fonts + SessionProvider
    globals.css           # Harbour theme tokens + base styles
    page.tsx              # session-aware redirect (/my-reports or /login)
    login/                # Google sign-in (branded)
    api/
      auth/[...nextauth]/ # NextAuth route
      health/             # health check
    (app)/                # authenticated app shell (sidebar + screens)
      my-reports/ ...     # dashboard, report form, submitted
      reports/ team/ roundups/ data-sources/ settings/
  components/             # sidebar, chrome, per-screen client UI
  db/                     # Drizzle client + schema
  lib/                    # auth options, mock data, types, avatar helpers
drizzle/                  # generated migrations + reset.sql
```

## Theming

Production default is the **Harbour** theme. All colours, the corner radius, and
the heading font are CSS custom properties in the `:root` block of
[`src/app/globals.css`](src/app/globals.css) — re-skinning to another brand
(e.g. Wonde) means editing only that block.

## Roadmap

Still mock / not yet wired to the database:

- Persist report drafts/submissions (`report_instances` + `answers`) and render
  My reports / the form / history from the DB.
- Admin writes: create/edit templates + questions (soft delete), manage team &
  roles, manage recipients, edit the schedule (`settings`).
- The weekly **lifecycle** job: open (Mon 01:00) / close (Sun 20:00, Europe/London),
  instance creation, lock after close.
- **Google Sheets** read (service account) per report.
- **AI generation**: turn the week's answers + sheet data + history into the
  Skim/Full Roundup; status `pending → draft → sent`.
