-- ============================================================================
-- Migration 0010 — org-wide default questions
--
-- default_questions holds the questions an org wants on every NEW report
-- template. They are COPIED into the template's own questions rows at creation
-- (POST /api/templates), so per-report edits and deletions behave exactly like
-- any other question, and changing a default never rewrites an existing report.
--
-- Safe to re-run.
-- ============================================================================

-- FK named explicitly to match drizzle/reset.sql — inline REFERENCES would let
-- Postgres auto-name it (…_fkey) and re-open the dev/prod naming divergence
-- that migration 0009 closed.
CREATE TABLE IF NOT EXISTS "default_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "default_questions_org_id_organisations_id_fk"
		FOREIGN KEY ("org_id") REFERENCES "organisations"("id")
);
