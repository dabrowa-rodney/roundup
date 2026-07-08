-- ============================================================================
-- Migration 0006 — subscriptions
-- plan/plan_status/stripe_customer_id/trial_ends_at on organisations.
-- Org 1 (the founding org) is complimentary; other existing orgs get a fresh
-- 14-day Team trial from now. Safe to re-run.
-- ============================================================================

ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'free' NOT NULL;
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "plan_status" text;
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;

UPDATE "organisations" SET "plan" = 'complimentary' WHERE "id" = 1 AND "plan" = 'free';
UPDATE "organisations" SET "trial_ends_at" = now() + interval '14 days'
	WHERE "plan" = 'free' AND "trial_ends_at" IS NULL;
