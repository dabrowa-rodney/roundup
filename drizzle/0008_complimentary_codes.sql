-- ============================================================================
-- Migration 0008 — complimentary codes + time-limited complimentary access
--
--   * complimentary_codes — owner-minted, Roundup-internal free-access codes
--     redeemed on Settings → Plan & billing (discount codes stay in Stripe).
--   * organisations.complimentary_until — when a complimentary grant ends;
--     null with plan='complimentary' means a permanent (console) grant.
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "complimentary_until" timestamp;

CREATE TABLE IF NOT EXISTS "complimentary_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"months" integer NOT NULL,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "complimentary_codes_code_unique" UNIQUE("code")
);
