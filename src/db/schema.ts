import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

// ── Users ──────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  role: text('role').notNull().default('member'), // 'admin' | 'member'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ── Teams / Groups ─────────────────────────────────────
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ── Team membership ────────────────────────────────────
export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  userId: integer('user_id').notNull().references(() => users.id),
  role: text('role').notNull().default('member'), // 'lead' | 'member'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ── Weekly updates (individual submissions) ────────────
export const updates = pgTable('updates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  teamId: integer('team_id').notNull().references(() => teams.id),
  weekStart: timestamp('week_start').notNull(), // Monday of the reporting week
  content: jsonb('content').notNull(), // structured update data
  submitted: boolean('submitted').notNull().default(false),
  submittedAt: timestamp('submitted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ── Compiled reports (the weekly output) ───────────────
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  weekStart: timestamp('week_start').notNull(),
  content: jsonb('content'), // compiled report data
  generatedAt: timestamp('generated_at'),
  status: text('status').notNull().default('pending'), // 'pending' | 'generated' | 'published'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
