import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { db } from "@/db";
import {
  organisations,
  reportInstances,
  reportTemplates,
  roundups,
  settings,
  users,
} from "@/db/schema";
import { ConsoleOrgDetail } from "@/components/console-org-detail";

export const dynamic = "force-dynamic";

// Owner drill-down into one organisation: editable settings + read-only
// visibility over their team, templates and output.
export default async function ConsoleOrgPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    redirect(
      "https://www.roundup.work/login?callbackUrl=" +
        encodeURIComponent("https://console.roundup.work/"),
    );
  }
  if (!isSuperAdmin(email)) notFound();

  const { id } = await params;
  const orgId = parseInt(id, 10);
  if (isNaN(orgId)) notFound();

  const org = (
    await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1)
  )[0];
  if (!org) notFound();

  const [settingsRow, members, templates, weekAgg, roundupRows] =
    await Promise.all([
      db
        .select()
        .from(settings)
        .where(eq(settings.orgId, orgId))
        .limit(1)
        .then((r) => r[0] ?? null),
      db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.orgId, orgId))
        .orderBy(users.name),
      db
        .select({
          id: reportTemplates.id,
          name: reportTemplates.name,
          area: reportTemplates.area,
          dataSourceUrl: reportTemplates.dataSourceUrl,
          archivedAt: reportTemplates.archivedAt,
          deletedAt: reportTemplates.deletedAt,
        })
        .from(reportTemplates)
        .where(eq(reportTemplates.orgId, orgId))
        .orderBy(reportTemplates.name),
      db
        .select({
          weekStart: reportInstances.weekStart,
          submitted: sql<number>`count(*) filter (where status in ('submitted','locked'))::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(reportInstances)
        .where(eq(reportInstances.orgId, orgId))
        .groupBy(reportInstances.weekStart)
        .orderBy(desc(reportInstances.weekStart))
        .limit(8),
      db
        .select({
          weekStart: roundups.weekStart,
          status: roundups.status,
          generatedAt: roundups.generatedAt,
          sentAt: roundups.sentAt,
        })
        .from(roundups)
        .where(eq(roundups.orgId, orgId))
        .orderBy(desc(roundups.weekStart))
        .limit(8),
    ]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/roundup-icon.svg" alt="" className="h-7 w-7" />
          <span className="font-head text-[17px] font-bold tracking-[-0.01em]">
            Roundup Console
          </span>
          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            Owner
          </span>
          <div className="flex-1" />
          <Link
            href="/console"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft size={14} /> All organisations
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <ConsoleOrgDetail
          org={{
            id: org.id,
            name: org.name,
            slug: org.slug,
            createdAt: org.createdAt.toISOString(),
            hasAnthropicKey: !!org.anthropicKeyEnc,
            plan: org.plan,
            planStatus: org.planStatus,
            trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
          }}
          settings={
            settingsRow
              ? {
                  closeDay: settingsRow.closeDay,
                  closeTime: settingsRow.closeTime,
                  openDay: settingsRow.openDay,
                  openTime: settingsRow.openTime,
                  reminder1Enabled: settingsRow.reminder1Enabled,
                  reminder1Day: settingsRow.reminder1Day,
                  reminder1Time: settingsRow.reminder1Time,
                  reminder2Enabled: settingsRow.reminder2Enabled,
                  reminder2Day: settingsRow.reminder2Day,
                  reminder2Time: settingsRow.reminder2Time,
                  reminderRoundupReady: settingsRow.reminderRoundupReady,
                }
              : null
          }
          members={members.map((m) => ({
            ...m,
            lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
            createdAt: m.createdAt.toISOString(),
          }))}
          templates={templates.map((t) => ({
            ...t,
            archivedAt: t.archivedAt?.toISOString() ?? null,
            deletedAt: t.deletedAt?.toISOString() ?? null,
          }))}
          weeks={weekAgg}
          roundups={roundupRows.map((r) => ({
            ...r,
            generatedAt: r.generatedAt?.toISOString() ?? null,
            sentAt: r.sentAt?.toISOString() ?? null,
          }))}
        />
      </main>
    </div>
  );
}
