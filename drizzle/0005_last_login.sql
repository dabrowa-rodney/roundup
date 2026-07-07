-- ============================================================================
-- Migration 0005 — last-login tracking
-- last_login_at is stamped on every sign-in; NULL means the member was
-- invited but has never signed in. Existing members who have a Google id
-- have demonstrably signed in, so backfill them from updated_at.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;

UPDATE "users" SET "last_login_at" = "updated_at"
	WHERE "last_login_at" IS NULL AND "google_id" IS NOT NULL;
