CREATE TABLE "answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"value" jsonb,
	"attachments" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "answers_instance_id_question_id_unique" UNIQUE("instance_id","question_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "report_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_assignees_template_id_user_id_unique" UNIQUE("template_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "report_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"week_start" timestamp NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"opened_at" timestamp,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_instances_template_id_user_id_week_start_unique" UNIQUE("template_id","user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"area" text,
	"cadence" text DEFAULT 'weekly' NOT NULL,
	"data_source_url" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roundup_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"roundup_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "roundup_recipients_roundup_id_user_id_unique" UNIQUE("roundup_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "roundups" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"skim_json" jsonb,
	"full_json" jsonb,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roundups_week_start_unique" UNIQUE("week_start")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"close_day" text DEFAULT 'Sunday' NOT NULL,
	"close_time" text DEFAULT '20:00' NOT NULL,
	"open_day" text DEFAULT 'Monday' NOT NULL,
	"open_time" text DEFAULT '01:00' NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"reminder_friday" boolean DEFAULT true NOT NULL,
	"reminder_sunday" boolean DEFAULT true NOT NULL,
	"reminder_roundup_ready" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"google_id" text,
	"role" text DEFAULT 'contributor' NOT NULL,
	"avatar_color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_instance_id_report_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."report_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_assignees" ADD CONSTRAINT "report_assignees_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_assignees" ADD CONSTRAINT "report_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundup_recipients" ADD CONSTRAINT "roundup_recipients_roundup_id_roundups_id_fk" FOREIGN KEY ("roundup_id") REFERENCES "public"."roundups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundup_recipients" ADD CONSTRAINT "roundup_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;