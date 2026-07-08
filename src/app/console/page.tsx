import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { db } from "@/db";
import {
  organisations,
  reportInstances,
  reportTemplates,
  roundups,
  users,
} from "@/db/schema";
import { mondayISO, relativeTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

interface OrgRow {
  id: number;
  name: string;
  slug: string;
  plan: string;
  isTrial: boolean;
  createdAt: Date;
  hasKey: boolean;
  members: number;
  pending: number;
  templates: number;
  sheets: number;
  reportsWeek: number;
  reportsTotal: number;
  roundupsSent: number;
  roundupsTotal: number;
  lastActive: Date | null;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[150px] flex-1 rounded-[14px] border border-line bg-surface px-5 py-4">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1 font-head text-[24px] font-bold tracking-[-0.02em]">
        {value}
      </div>
    </div>
  );
}

// The business-owner console: every organisation on the platform with its
// vital signs. Gated to SUPER_ADMIN_EMAILS — tenants can never grant this.
export default async function ConsolePage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    redirect(
      "https://www.roundup.work/login?callbackUrl=" +
        encodeURIComponent("https://console.roundup.work/"),
    );
  }
  if (!isSuperAdmin(email)) notFound();

  const now = new Date();
  const weekIso = mondayISO(now);
  const activeCutoff = new Date(now.getTime() - 7 * 86_400_000);

  const [orgs, memberAgg, templateAgg, instanceAgg, roundupAgg] =
    await Promise.all([
      db.select().from(organisations).orderBy(organisations.createdAt),
      db
        .select({
          orgId: users.orgId,
          members: sql<number>`count(*)::int`,
          pending: sql<number>`count(*) filter (where last_login_at is null)::int`,
          active7d: sql<number>`count(*) filter (where last_login_at > ${activeCutoff})::int`,
          lastActive: sql<Date | null>`max(last_login_at)`,
        })
        .from(users)
        .groupBy(users.orgId),
      db
        .select({
          orgId: reportTemplates.orgId,
          templates: sql<number>`count(*) filter (where archived_at is null)::int`,
          sheets: sql<number>`count(*) filter (where archived_at is null and data_source_url is not null)::int`,
        })
        .from(reportTemplates)
        .groupBy(reportTemplates.orgId),
      db
        .select({
          orgId: reportInstances.orgId,
          reportsTotal: sql<number>`count(*) filter (where status in ('submitted','locked'))::int`,
          reportsWeek: sql<number>`count(*) filter (where status in ('submitted','locked') and week_start = ${weekIso})::int`,
        })
        .from(reportInstances)
        .groupBy(reportInstances.orgId),
      db
        .select({
          orgId: roundups.orgId,
          roundupsTotal: sql<number>`count(*)::int`,
          roundupsSent: sql<number>`count(*) filter (where status = 'sent')::int`,
        })
        .from(roundups)
        .groupBy(roundups.orgId),
    ]);

  const byOrg = <T extends { orgId: number }>(rows: T[]) =>
    new Map(rows.map((r) => [r.orgId, r]));
  const mMap = byOrg(memberAgg);
  const tMap = byOrg(templateAgg);
  const iMap = byOrg(instanceAgg);
  const rMap = byOrg(roundupAgg);

  const rows: OrgRow[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan,
    isTrial:
      o.plan === "free" &&
      !!o.trialEndsAt &&
      o.trialEndsAt.getTime() > now.getTime(),
    createdAt: o.createdAt,
    hasKey: !!o.anthropicKeyEnc,
    members: mMap.get(o.id)?.members ?? 0,
    pending: mMap.get(o.id)?.pending ?? 0,
    templates: tMap.get(o.id)?.templates ?? 0,
    sheets: tMap.get(o.id)?.sheets ?? 0,
    reportsWeek: iMap.get(o.id)?.reportsWeek ?? 0,
    reportsTotal: iMap.get(o.id)?.reportsTotal ?? 0,
    roundupsSent: rMap.get(o.id)?.roundupsSent ?? 0,
    roundupsTotal: rMap.get(o.id)?.roundupsTotal ?? 0,
    lastActive: mMap.get(o.id)?.lastActive ?? null,
  }));

  const totals = {
    orgs: rows.length,
    members: rows.reduce((n, r) => n + r.members, 0),
    active7d: memberAgg.reduce((n, r) => n + r.active7d, 0),
    reportsWeek: rows.reduce((n, r) => n + r.reportsWeek, 0),
    roundupsSent: rows.reduce((n, r) => n + r.roundupsSent, 0),
  };

  const COLS =
    "min-w-[980px] grid-cols-[1.6fr_0.9fr_0.9fr_0.8fr_1fr_1fr_0.6fr_1fr]";

  return (
    <div className="min-h-screen bg-bg">
      {/* Console header */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-6 py-4">
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
            href="/console/discounts"
            className="mr-4 text-[13px] font-semibold text-muted hover:text-ink"
          >
            Discounts
          </Link>
          <a
            href="https://www.roundup.work/my-reports"
            className="text-[13px] font-semibold text-muted hover:text-ink"
          >
            Back to the app →
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        {/* Platform stats */}
        <div className="flex flex-wrap gap-3.5">
          <StatCard label="Organisations" value={totals.orgs} />
          <StatCard label="Members" value={totals.members} />
          <StatCard label="Active in last 7 days" value={totals.active7d} />
          <StatCard label="Reports in this week" value={totals.reportsWeek} />
          <StatCard label="Roundups sent (all time)" value={totals.roundupsSent} />
        </div>

        {/* Organisations table */}
        <div className="mt-8 overflow-x-auto rounded-card border border-line bg-surface">
          <div
            className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-bold tracking-[0.04em] text-muted`}
          >
            <span>ORGANISATION</span>
            <span>SIGNED UP</span>
            <span>MEMBERS</span>
            <span>TEMPLATES</span>
            <span>REPORTS IN</span>
            <span>ROUNDUPS</span>
            <span>AI</span>
            <span>LAST ACTIVE</span>
          </div>
          {rows.map((r) => (
            <Link
              href={`/console/orgs/${r.id}`}
              key={r.id}
              className={`grid ${COLS} items-center gap-3.5 border-t border-line px-[22px] py-[15px] transition-colors hover:bg-accent-soft/30`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{r.name}</span>
                  <span
                    className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.03em] ${
                      r.plan === "complimentary"
                        ? "bg-good-soft text-good-ink"
                        : r.plan === "team" || r.plan === "business"
                          ? "bg-accent-soft text-accent"
                          : r.isTrial
                            ? "bg-warn-soft text-warn-ink"
                            : "bg-line/50 text-muted"
                    }`}
                  >
                    {r.plan === "complimentary"
                      ? "comp"
                      : r.isTrial
                        ? "trial"
                        : r.plan}
                  </span>
                </div>
                <div className="truncate font-mono text-[11.5px] text-muted">
                  {r.slug}.roundup.work
                </div>
              </div>
              <span className="text-[13px] text-muted">
                {r.createdAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="text-[13.5px]">
                {r.members}
                {r.pending > 0 && (
                  <span className="ml-1.5 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn-ink">
                    {r.pending} pending
                  </span>
                )}
              </span>
              <span className="text-[13.5px]">
                {r.templates}
                {r.sheets > 0 && (
                  <span className="ml-1 text-[11.5px] text-good">
                    · {r.sheets} sheet{r.sheets === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              <span className="text-[13.5px]">
                {r.reportsWeek} this wk
                <span className="text-muted"> · {r.reportsTotal} total</span>
              </span>
              <span className="text-[13.5px]">
                {r.roundupsSent} sent
                <span className="text-muted"> · {r.roundupsTotal} total</span>
              </span>
              <span
                className={`text-[13px] font-semibold ${r.hasKey ? "text-good" : "text-muted"}`}
              >
                {r.hasKey ? "✓ key" : "—"}
              </span>
              <span className="text-[13px] text-muted">
                {r.lastActive ? relativeTime(r.lastActive) : "never"}
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-4 text-[12.5px] text-muted">
          Owner access is controlled by the SUPER_ADMIN_EMAILS environment
          variable.
        </p>
      </main>
    </div>
  );
}
