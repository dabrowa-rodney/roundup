-- ============================================================================
-- Migration 0002 — multi-tenancy
--   • organisations table (tenants), with encrypted per-org Anthropic key
--   • org_id on users, report_templates, report_instances, roundups,
--     email_log, settings — backfilled to organisation 1 (the original org)
--   • per-org unique constraints replace the old global ones
--
-- Safe to re-run. Run with:
--   psql "$DATABASE_URL" -f drizzle/0002_multi_tenancy.sql
-- or paste into the Neon SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "organisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"anthropic_key_enc" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug")
);

-- Organisation 1: the original tenant (existing data belongs to it).
INSERT INTO "organisations" ("id", "name", "slug")
	VALUES (1, 'Wonde', 'wonde')
	ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('organisations', 'id'),
	(SELECT MAX(id) FROM organisations));

-- ── org_id columns: add → backfill → NOT NULL → FK ──
-- DEFAULT 1 keeps the previous (single-tenant) deployment working during the
-- migrate→deploy window; drop the defaults once the new code is live:
--   ALTER TABLE <t> ALTER COLUMN org_id DROP DEFAULT;  (for each table)
DO $$
DECLARE t text;
BEGIN
	FOREACH t IN ARRAY ARRAY['users','report_templates','report_instances','roundups','email_log','settings'] LOOP
		EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id integer DEFAULT 1', t);
		EXECUTE format('UPDATE %I SET org_id = 1 WHERE org_id IS NULL', t);
		EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET NOT NULL', t);
		IF NOT EXISTS (
			SELECT 1 FROM pg_constraint WHERE conname = t || '_org_id_organisations_id_fk'
		) THEN
			EXECUTE format(
				'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES organisations(id)',
				t, t || '_org_id_organisations_id_fk');
		END IF;
	END LOOP;
END $$;

-- ── unique constraints: global → per-org ──
ALTER TABLE "roundups" DROP CONSTRAINT IF EXISTS "roundups_week_start_unique";
DO $$ BEGIN
	ALTER TABLE "roundups" ADD CONSTRAINT "roundups_org_id_week_start_unique" UNIQUE("org_id","week_start");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

ALTER TABLE "email_log" DROP CONSTRAINT IF EXISTS "email_log_kind_week_start_unique";
DO $$ BEGIN
	ALTER TABLE "email_log" ADD CONSTRAINT "email_log_org_id_kind_week_start_unique" UNIQUE("org_id","kind","week_start");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	ALTER TABLE "settings" ADD CONSTRAINT "settings_org_id_unique" UNIQUE("org_id");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
