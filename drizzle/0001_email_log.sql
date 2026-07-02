-- ============================================================================
-- Migration 0001 — email sending (reminders + roundup distribution)
--   • email_log: one row per email batch; UNIQUE(kind, week_start) makes
--     reminder/notification sends idempotent per week.
--   • roundups.sent_at: when the roundup was distributed to recipients.
--
-- Run with either:
--   psql "$DATABASE_URL" -f drizzle/0001_email_log.sql
-- or paste into the Neon SQL editor and run. Safe to re-run.
-- ============================================================================

ALTER TABLE "roundups" ADD COLUMN IF NOT EXISTS "sent_at" timestamp;

CREATE TABLE IF NOT EXISTS "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"week_start" date NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_log_kind_week_start_unique" UNIQUE("kind","week_start")
);
