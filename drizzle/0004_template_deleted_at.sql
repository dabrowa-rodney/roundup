-- ============================================================================
-- Migration 0004 — report template deletion with 7-day recovery
-- deleted_at marks a template for permanent removal; the lifecycle cron
-- purges it (and its instances + answers) 7 days later. Deleted templates
-- also carry archived_at, so existing "active" filters exclude them.
-- Safe to re-run.
--   psql "$DATABASE_URL" -f drizzle/0004_template_deleted_at.sql
-- ============================================================================

ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
