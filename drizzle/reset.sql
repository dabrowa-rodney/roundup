-- ============================================================================
-- Roundup — full database reset ("blank canvas")
-- Drops the legacy scaffold tables AND any existing Roundup tables, then
-- recreates the current schema. Safe to re-run. DESTRUCTIVE: deletes all data.
--
-- Run with either:
--   psql "$DATABASE_URL" -f drizzle/reset.sql
-- or paste this whole file into the Neon SQL editor and run.
--
-- (Alternatively, `npm run db:push` syncs the schema interactively without
--  this script — but that prompts before dropping the legacy tables.)
-- ============================================================================

-- ── Drop legacy scaffold tables (from the original starter) ──
DROP TABLE IF EXISTS "reports" CASCADE;
DROP TABLE IF EXISTS "updates" CASCADE;
DROP TABLE IF EXISTS "team_members" CASCADE;
DROP TABLE IF EXISTS "teams" CASCADE;

-- ── Drop current Roundup tables (so the script is idempotent) ──
DROP TABLE IF EXISTS "answers" CASCADE;
DROP TABLE IF EXISTS "report_instances" CASCADE;
DROP TABLE IF EXISTS "questions" CASCADE;
DROP TABLE IF EXISTS "report_assignees" CASCADE;
DROP TABLE IF EXISTS "report_templates" CASCADE;
DROP TABLE IF EXISTS "roundup_recipients" CASCADE;
DROP TABLE IF EXISTS "email_log" CASCADE;
DROP TABLE IF EXISTS "login_tokens" CASCADE;
DROP TABLE IF EXISTS "roundups" CASCADE;
DROP TABLE IF EXISTS "settings" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "organisations" CASCADE;

-- ── Recreate the Roundup schema ──
CREATE TABLE "organisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"anthropic_key_enc" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_status" text,
	"stripe_customer_id" text,
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug")
);

CREATE TABLE "answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"value" jsonb,
	"attachments" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "answers_instance_id_question_id_unique" UNIQUE("instance_id","question_id")
);

CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "report_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_assignees_template_id_user_id_unique" UNIQUE("template_id","user_id")
);

CREATE TABLE "report_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"template_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"opened_at" timestamp,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_instances_template_id_user_id_week_start_unique" UNIQUE("template_id","user_id","week_start")
);

CREATE TABLE "report_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"area" text,
	"cadence" text DEFAULT 'weekly' NOT NULL,
	"data_source_url" text,
	"archived_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "roundup_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"roundup_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "roundup_recipients_roundup_id_user_id_unique" UNIQUE("roundup_id","user_id")
);

CREATE TABLE "roundups" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"skim_json" jsonb,
	"full_json" jsonb,
	"generated_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roundups_org_id_week_start_unique" UNIQUE("org_id","week_start")
);

CREATE TABLE "login_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "login_tokens_token_hash_unique" UNIQUE("token_hash")
);
CREATE INDEX "login_tokens_email_idx" ON "login_tokens" ("email");

CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"kind" text NOT NULL,
	"week_start" date NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_log_org_id_kind_week_start_unique" UNIQUE("org_id","kind","week_start")
);

CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"close_day" text DEFAULT 'Sunday' NOT NULL,
	"close_time" text DEFAULT '20:00' NOT NULL,
	"open_day" text DEFAULT 'Monday' NOT NULL,
	"open_time" text DEFAULT '01:00' NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"reminder1_enabled" boolean DEFAULT true NOT NULL,
	"reminder1_day" text DEFAULT 'Thursday' NOT NULL,
	"reminder1_time" text DEFAULT '13:00' NOT NULL,
	"reminder2_enabled" boolean DEFAULT true NOT NULL,
	"reminder2_day" text DEFAULT 'Friday' NOT NULL,
	"reminder2_time" text DEFAULT '09:00' NOT NULL,
	"reminder_roundup_ready" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_org_id_unique" UNIQUE("org_id")
);

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"google_id" text,
	"role" text DEFAULT 'contributor' NOT NULL,
	"avatar_color" text,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

ALTER TABLE "answers" ADD CONSTRAINT "answers_instance_id_report_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."report_instances"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "questions" ADD CONSTRAINT "questions_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "report_assignees" ADD CONSTRAINT "report_assignees_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "report_assignees" ADD CONSTRAINT "report_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "roundup_recipients" ADD CONSTRAINT "roundup_recipients_roundup_id_roundups_id_fk" FOREIGN KEY ("roundup_id") REFERENCES "public"."roundups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "roundup_recipients" ADD CONSTRAINT "roundup_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "roundups" ADD CONSTRAINT "roundups_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "settings" ADD CONSTRAINT "settings_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
