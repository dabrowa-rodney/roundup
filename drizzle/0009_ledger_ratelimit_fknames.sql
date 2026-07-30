-- ============================================================================
-- Migration 0009 — redemption ledger, rate limits, FK name alignment
--
--   * complimentary_redemptions — one row per (code × org). The UNIQUE key
--     stops an org redeeming the same code twice, and the row is the audit
--     trail a bare times_redeemed counter can't provide.
--   * rate_limits — fixed-window counters for /api/billing/redeem and the
--     magic-link endpoint. DB-backed because serverless instances share no
--     memory (see lib/rate-limit.ts).
--   * FK renames — 0007 created teams/team_members with inline REFERENCES, so
--     Postgres auto-named those constraints (…_fkey) while drizzle/reset.sql
--     names them explicitly (…_teams_id_fk). Same constraints, different
--     names, so a fresh dev DB and a migrated production DB disagreed — and a
--     future migration referencing a name would work in one and fail in the
--     other. Align production onto the reset.sql names.
--
-- Safe to re-run.
-- ============================================================================

-- FKs are named explicitly to match drizzle/reset.sql — inline REFERENCES would
-- let Postgres auto-name them (…_fkey) and re-open the very dev/prod divergence
-- this migration exists to close.
CREATE TABLE IF NOT EXISTS "complimentary_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_id" integer NOT NULL,
	"org_id" integer NOT NULL,
	"user_id" integer,
	"months" integer NOT NULL,
	"granted_until" timestamp,
	"redeemed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "complimentary_redemptions_code_id_org_id_unique" UNIQUE("code_id","org_id"),
	CONSTRAINT "complimentary_redemptions_code_id_complimentary_codes_id_fk"
		FOREIGN KEY ("code_id") REFERENCES "complimentary_codes"("id") ON DELETE cascade,
	CONSTRAINT "complimentary_redemptions_org_id_organisations_id_fk"
		FOREIGN KEY ("org_id") REFERENCES "organisations"("id"),
	CONSTRAINT "complimentary_redemptions_user_id_users_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null
);

CREATE TABLE IF NOT EXISTS "rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_bucket_window_start_unique" UNIQUE("bucket","window_start")
);

-- Sweeping old windows filters on window_start.
CREATE INDEX IF NOT EXISTS "rate_limits_window_start_idx"
	ON "rate_limits" ("window_start");

-- ── Align the four auto-named FKs with the names reset.sql uses ──
-- ALTER … RENAME CONSTRAINT has no IF EXISTS, so each is guarded: skip when
-- the old name is already gone (re-run, or a DB built from reset.sql).
DO $$
DECLARE
	r record;
BEGIN
	FOR r IN
		SELECT * FROM (VALUES
			('team_members', 'team_members_team_id_fkey',      'team_members_team_id_teams_id_fk'),
			('team_members', 'team_members_user_id_fkey',      'team_members_user_id_users_id_fk'),
			('teams',        'teams_org_id_fkey',              'teams_org_id_organisations_id_fk'),
			('teams',        'teams_parent_team_id_fkey',      'teams_parent_team_id_teams_id_fk')
		) AS v(tbl, old_name, new_name)
	LOOP
		IF EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conname = r.old_name AND conrelid = r.tbl::regclass
		) AND NOT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conname = r.new_name AND conrelid = r.tbl::regclass
		) THEN
			EXECUTE format(
				'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
				r.tbl, r.old_name, r.new_name
			);
		END IF;
	END LOOP;
END $$;
