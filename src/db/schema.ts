import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  timestamp,
  date,
  integer,
  boolean,
  jsonb,
  unique,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/*
  Roundup data model (see the design handoff). Historical responses are never
  hard-deleted — `archivedAt` columns implement soft deletes so past answers
  remain available as context for future Roundups.

  MULTI-TENANCY: every tenant-owned table carries `org_id`. Rows are always
  read/written through the session user's organisation — never trust an org id
  from the client. Tables reachable only via an org-scoped parent (questions,
  answers, roundup_recipients) rely on the parent's org_id.
*/

// ── Organisations (tenants) ────────────────────────────
// Billing is org-level — gate features by organisation, never by user.
// plan: 'free' | 'team' | 'business' | 'complimentary' (owner-granted).
// planStatus mirrors the Stripe subscription status ('active', 'past_due',
// 'canceled', …) and is null for free/complimentary. trialEndsAt drives the
// card-free 14-day Team trial for new signups. See lib/plans.ts.
export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Subdomain-safe identifier ("acme" → acme.roundup.work). Lowercase a-z0-9-.
  slug: text("slug").notNull().unique(),
  // Org's own Anthropic API key, AES-256-GCM encrypted (see lib/crypto.ts).
  // Null = no AI generation; the deterministic compiler is used instead.
  anthropicKeyEnc: text("anthropic_key_enc"),
  plan: text("plan").notNull().default("free"),
  planStatus: text("plan_status"),
  stripeCustomerId: text("stripe_customer_id"),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Users ──────────────────────────────────────────────
// role: 'admin' | 'contributor' | 'recipient'
// One organisation per email address (v1) — email stays globally unique.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => organisations.id),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  googleId: text("google_id"),
  role: text("role").notNull().default("contributor"),
  avatarColor: text("avatar_color"),
  // Stamped on every sign-in; null = invited but never signed in yet.
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Teams (self-referential tree, org-scoped) ──────────
// The org's structure: teams nest inside teams to any depth. Every org has
// exactly ONE root team (parent_team_id IS NULL — enforced by a partial
// unique index) created on migration/signup, so flat orgs keep working
// unchanged as "a one-team tree".
//   cadence:       'weekly' | 'monthly' | 'quarterly' — the team's roundup period
//   rollup_mode:   'members'  → summarise members' individual reports
//                  'children' → summarise child teams' roundups + child leads' reports
//                  'both'     → union of the two
//   template_mode: 'shared'     → one template, every member implicitly assigned
//                  'per_member' → explicit report_assignees (as today)
// Cycle/depth safety is enforced on write in lib/teams.ts, not by the DB.
export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organisations.id),
    parentTeamId: integer("parent_team_id").references(
      (): AnyPgColumn => teams.id,
    ),
    name: text("name").notNull(),
    cadence: text("cadence").notNull().default("weekly"),
    rollupMode: text("rollup_mode").notNull().default("members"),
    templateMode: text("template_mode").notNull().default("per_member"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // One root per org — makes root get-or-create race-safe.
    uniqueIndex("teams_one_root_per_org")
      .on(t.orgId)
      .where(sql`${t.parentTeamId} IS NULL`),
  ],
);

// ── Team ↔ member (many-to-many; role is PER TEAM) ─────
// role: 'lead' | 'member'. A person can belong to several teams and lead one
// while being a member of another. "Team lead" lives here — NOT on users.role
// (which stays the org-level admin/contributor/recipient role).
export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.teamId, t.userId)],
);

// ── Report templates ───────────────────────────────────
// Lifecycle: active → archived (reversible, keeps everything) → deleted
// (7-day grace, then the cron purges the template and its instances/answers).
// A deleted template ALWAYS also has archivedAt set, so every "active"
// query (isNull(archivedAt)) excludes deleted templates by construction.
export const reportTemplates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => organisations.id),
  // The owning team. A report contributes to ITS TEMPLATE'S team's roundup —
  // multi-team membership governs roles/visibility, not report routing (D1).
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  name: text("name").notNull(),
  area: text("area"),
  cadence: text("cadence").notNull().default("weekly"),
  dataSourceUrl: text("data_source_url"),
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Template ↔ assignee (a template can be assigned to many users) ──
export const reportAssignees = pgTable(
  "report_assignees",
  {
    id: serial("id").primaryKey(),
    templateId: integer("template_id")
      .notNull()
      .references(() => reportTemplates.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.templateId, t.userId)],
);

// ── Questions ──────────────────────────────────────────
// type: 'rag' | 'long_text' | 'short_text' | 'single_choice'
//     | 'multi_choice' | 'number' | 'file_link'
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => reportTemplates.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  text: text("text").notNull(),
  type: text("type").notNull(),
  config: jsonb("config"), // options, unit, helper, etc.
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Report instances (one per template × user × week) ──
// status: 'not_started' | 'in_progress' | 'submitted' | 'locked'
export const reportInstances = pgTable(
  "report_instances",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organisations.id),
    templateId: integer("template_id")
      .notNull()
      .references(() => reportTemplates.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    status: text("status").notNull().default("not_started"),
    openedAt: timestamp("opened_at"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.templateId, t.userId, t.weekStart)],
);

// ── Answers ────────────────────────────────────────────
export const answers = pgTable(
  "answers",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => reportInstances.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id),
    value: jsonb("value"), // typed by question
    attachments: jsonb("attachments"), // [{ name, url }]
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.instanceId, t.questionId)],
);

// ── Roundups (the generated periodic summary) ──────────
// status: 'pending' | 'draft' | 'sent'
// ONE PER TEAM PER PERIOD — the unique key is (team_id, period_type,
// period_start). org_id stays for tenancy scoping and cheap org-wide queries.
// period_type: 'week' | 'month' | 'quarter'; period_start is the calendar-
// aligned first day (Monday / 1st of month / quarter start — see lib/dates.ts).
// week_start is a legacy mirror of period_start (kept for existing queries;
// equals period_start for every period type).
export const roundups = pgTable(
  "roundups",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organisations.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    periodType: text("period_type").notNull().default("week"),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    status: text("status").notNull().default("pending"),
    skimJson: jsonb("skim_json"),
    fullJson: jsonb("full_json"),
    generatedAt: timestamp("generated_at"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.teamId, t.periodType, t.periodStart)],
);

// ── Roundup ↔ recipient ────────────────────────────────
export const roundupRecipients = pgTable(
  "roundup_recipients",
  {
    id: serial("id").primaryKey(),
    roundupId: integer("roundup_id")
      .notNull()
      .references(() => roundups.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.roundupId, t.userId)],
);

// ── Magic-link sign-in tokens ──────────────────────────
// One active token per email (request deletes prior ones). Only the SHA-256
// hash is stored; the raw token exists solely in the emailed link. Tokens are
// single-use and expire 15 minutes after issue.
export const loginTokens = pgTable("login_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"), // carried from the sign-up form for first-time users
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Email log (one row per batch actually sent) ────────
// kind: 'reminder1' | 'reminder2' | 'roundup_ready' | 'roundup_sent'
// The (kind, weekStart) unique key is what makes reminder sending idempotent —
// however often the cron endpoint is hit, each slot fires at most once a week.
export const emailLog = pgTable(
  "email_log",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organisations.id),
    kind: text("kind").notNull(),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.orgId, t.kind, t.weekStart)],
);

// ── Org settings (one row per organisation) ────────────
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .unique()
    .references(() => organisations.id),
  closeDay: text("close_day").notNull().default("Sunday"),
  closeTime: text("close_time").notNull().default("20:00"),
  openDay: text("open_day").notNull().default("Monday"),
  openTime: text("open_time").notNull().default("01:00"),
  timezone: text("timezone").notNull().default("Europe/London"),
  // Two reminder slots — sent ahead of close to contributors who haven't submitted.
  reminder1Enabled: boolean("reminder1_enabled").notNull().default(true),
  reminder1Day: text("reminder1_day").notNull().default("Thursday"),
  reminder1Time: text("reminder1_time").notNull().default("13:00"),
  reminder2Enabled: boolean("reminder2_enabled").notNull().default(true),
  reminder2Day: text("reminder2_day").notNull().default("Friday"),
  reminder2Time: text("reminder2_time").notNull().default("09:00"),
  // Notify recipients when the weekly Roundup summary is generated.
  reminderRoundupReady: boolean("reminder_roundup_ready")
    .notNull()
    .default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
