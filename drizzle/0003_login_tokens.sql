-- ============================================================================
-- Migration 0003 — magic-link sign-in tokens
-- Single-use, 15-minute email sign-in links. Only the SHA-256 hash of the
-- token is stored. Safe to re-run.
--   psql "$DATABASE_URL" -f drizzle/0003_login_tokens.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS "login_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "login_tokens_token_hash_unique" UNIQUE("token_hash")
);

CREATE INDEX IF NOT EXISTS "login_tokens_email_idx" ON "login_tokens" ("email");
