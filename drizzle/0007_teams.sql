-- ============================================================================
-- Migration 0007 — nested teams & per-team roundup periods
--
-- Turns the flat org into a team tree (see docs/DESIGN-nested-teams.md):
--   * teams          — self-referential tree, one ROOT team per org
--   * team_members   — many-to-many, role ('lead'|'member') is per team
--   * report_templates.team_id — every template now belongs to a team
--   * roundups       — re-keyed from unique(org_id, week_start) to
--                      unique(team_id, period_type, period_start)
--
-- Backfill makes every existing org "a one-team tree": a root team named
-- after the org, all users enrolled (admins → lead), templates and roundups
-- attached to the root. No user-visible behaviour changes.
-- Safe to re-run.
-- ============================================================================

-- ── teams ──
CREATE TABLE IF NOT EXISTS "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL REFERENCES "organisations"("id"),
	"parent_team_id" integer REFERENCES "teams"("id"),
	"name" text NOT NULL,
	"cadence" text DEFAULT 'weekly' NOT NULL,
	"rollup_mode" text DEFAULT 'members' NOT NULL,
	"template_mode" text DEFAULT 'per_member' NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- One root team per org (root = parent IS NULL); makes get-or-create race-safe.
CREATE UNIQUE INDEX IF NOT EXISTS "teams_one_root_per_org"
	ON "teams" ("org_id") WHERE "parent_team_id" IS NULL;

-- ── team_members ──
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_unique" UNIQUE("team_id","user_id")
);

-- ── Backfill: one root team per org, named after the org ──
INSERT INTO "teams" ("org_id", "name")
SELECT o."id", o."name"
FROM "organisations" o
WHERE NOT EXISTS (
	SELECT 1 FROM "teams" t
	WHERE t."org_id" = o."id" AND t."parent_team_id" IS NULL
);

-- Enrol every user in their org's root team; global admins become leads.
INSERT INTO "team_members" ("team_id", "user_id", "role")
SELECT t."id", u."id",
	CASE WHEN u."role" = 'admin' THEN 'lead' ELSE 'member' END
FROM "users" u
JOIN "teams" t ON t."org_id" = u."org_id" AND t."parent_team_id" IS NULL
ON CONFLICT DO NOTHING;

-- ── report_templates.team_id ──
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "team_id" integer;

UPDATE "report_templates" rt
SET "team_id" = t."id"
FROM "teams" t
WHERE rt."team_id" IS NULL
	AND t."org_id" = rt."org_id" AND t."parent_team_id" IS NULL;

ALTER TABLE "report_templates" ALTER COLUMN "team_id" SET NOT NULL;

DO $$ BEGIN
	ALTER TABLE "report_templates"
		ADD CONSTRAINT "report_templates_team_id_teams_id_fk"
		FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── roundups → (team_id, period_type, period_start) ──
ALTER TABLE "roundups" ADD COLUMN IF NOT EXISTS "team_id" integer;
ALTER TABLE "roundups" ADD COLUMN IF NOT EXISTS "period_type" text DEFAULT 'week' NOT NULL;
ALTER TABLE "roundups" ADD COLUMN IF NOT EXISTS "period_start" date;

UPDATE "roundups" r
SET "team_id" = t."id"
FROM "teams" t
WHERE r."team_id" IS NULL
	AND t."org_id" = r."org_id" AND t."parent_team_id" IS NULL;

UPDATE "roundups" SET "period_start" = "week_start" WHERE "period_start" IS NULL;

ALTER TABLE "roundups" ALTER COLUMN "team_id" SET NOT NULL;
ALTER TABLE "roundups" ALTER COLUMN "period_start" SET NOT NULL;

DO $$ BEGIN
	ALTER TABLE "roundups"
		ADD CONSTRAINT "roundups_team_id_teams_id_fk"
		FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Swap the unique key: many roundups per org now — one per team per period.
ALTER TABLE "roundups" DROP CONSTRAINT IF EXISTS "roundups_org_id_week_start_unique";

DO $$ BEGIN
	ALTER TABLE "roundups"
		ADD CONSTRAINT "roundups_team_id_period_type_period_start_unique"
		UNIQUE("team_id","period_type","period_start");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
