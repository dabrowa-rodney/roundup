import Link from "next/link";
import { getServerSession } from "next-auth";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  questions,
  reportAssignees,
  reportInstances,
  reportTemplates,
  users,
} from "@/db/schema";
import { Screen } from "@/components/screen";
import { ProgressBar, SectionLabel, StatusPill } from "@/components/ui";
import type { ReportStatus } from "@/lib/types";
import {
  greeting,
  mondayOf,
  relativeTime,
  weekLabel,
  weekNumberLabel,
  weekRange,
} from "@/lib/dates";

const STATUS_DISPLAY: Record<string, ReportStatus> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  locked: "Submitted",
};

function progressFor(status: ReportStatus): number {
  return status === "Submitted" ? 100 : status === "In progress" ? 55 : 0;
}

interface ReportCard {
  id: number;
  name: string;
  area: string | null;
  qCount: number;
  status: ReportStatus;
  cta: string;
  href: string;
  edited: string;
}

interface PreviousWeek {
  key: string;
  week: string;
  range: string;
  name: string;
  when: string;
  href: string;
}

export default async function MyReportsPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  const firstName = (session?.user?.name ?? "there").split(" ")[0];

  const monday = mondayOf(new Date());
  const thisWeekLabel = weekLabel(monday);

  const me = email
    ? (
        await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
      )[0]
    : undefined;

  let cards: ReportCard[] = [];
  let previous: PreviousWeek[] = [];

  if (me) {
    // Templates assigned to me (non-archived)
    const assigned = await db
      .select({
        id: reportTemplates.id,
        name: reportTemplates.name,
        area: reportTemplates.area,
      })
      .from(reportAssignees)
      .innerJoin(
        reportTemplates,
        eq(reportAssignees.templateId, reportTemplates.id),
      )
      .where(
        and(
          eq(reportAssignees.userId, me.id),
          isNull(reportTemplates.archivedAt),
        ),
      )
      .orderBy(reportTemplates.name);

    const ids = assigned.map((a) => a.id);

    if (ids.length > 0) {
      const qCounts = await db
        .select({
          templateId: questions.templateId,
          count: sql<number>`count(*)::int`,
        })
        .from(questions)
        .where(
          and(inArray(questions.templateId, ids), isNull(questions.archivedAt)),
        )
        .groupBy(questions.templateId);
      const qMap = new Map(qCounts.map((q) => [q.templateId, q.count]));

      // This week's instances for these templates
      const insts = await db
        .select()
        .from(reportInstances)
        .where(
          and(
            eq(reportInstances.userId, me.id),
            inArray(reportInstances.templateId, ids),
            eq(reportInstances.weekStart, monday),
          ),
        );
      const instMap = new Map(insts.map((i) => [i.templateId, i]));

      cards = assigned.map((a) => {
        const inst = instMap.get(a.id);
        const status = STATUS_DISPLAY[inst?.status ?? "not_started"] ?? "Not started";
        const submitted = status === "Submitted";
        return {
          id: a.id,
          name: a.name,
          area: a.area,
          qCount: qMap.get(a.id) ?? 0,
          status,
          cta: submitted ? "View" : status === "In progress" ? "Continue" : "Start",
          href: submitted
            ? `/my-reports/${a.id}/submitted`
            : `/my-reports/${a.id}`,
          edited: inst
            ? submitted
              ? `Submitted ${relativeTime(inst.submittedAt ?? inst.updatedAt)}`
              : `Edited ${relativeTime(inst.updatedAt)}`
            : "Not started yet",
        };
      });
    }

    // Previous weeks: submitted / locked instances before this week
    const prev = await db
      .select({
        templateId: reportInstances.templateId,
        name: reportTemplates.name,
        weekStart: reportInstances.weekStart,
        submittedAt: reportInstances.submittedAt,
      })
      .from(reportInstances)
      .innerJoin(
        reportTemplates,
        eq(reportInstances.templateId, reportTemplates.id),
      )
      .where(
        and(
          eq(reportInstances.userId, me.id),
          inArray(reportInstances.status, ["submitted", "locked"]),
          lt(reportInstances.weekStart, monday),
        ),
      )
      .orderBy(desc(reportInstances.weekStart))
      .limit(12);

    previous = prev.map((p) => {
      const ws = new Date(p.weekStart);
      return {
        key: `${p.templateId}-${ws.toISOString()}`,
        week: weekNumberLabel(ws),
        range: weekRange(ws),
        name: p.name,
        when: relativeTime(p.submittedAt),
        href: `/my-reports/${p.templateId}/submitted`,
      };
    });
  }

  const count = cards.length;

  return (
    <Screen title="My reports" subtitle="Your weekly updates">
      <div className="mb-6">
        <div className="font-head text-[26px] font-bold tracking-[-0.02em]">
          {greeting()}, {firstName} 👋
        </div>
        <p className="mt-1.5 text-[15px] text-muted">
          {count === 0 ? (
            <>You have no reports to file for {thisWeekLabel}.</>
          ) : (
            <>
              You have{" "}
              <strong className="text-ink">
                {count} report{count === 1 ? "" : "s"}
              </strong>{" "}
              to file for {thisWeekLabel}.
            </>
          )}
        </p>
      </div>

      {count === 0 ? (
        <div className="max-w-[840px] rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
            <Inbox size={22} className="text-accent" />
          </div>
          <div className="font-head text-[18px] font-bold">
            Nothing to file this week
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[14px] text-muted">
            No reports are assigned to you for {thisWeekLabel}. An administrator
            can assign you one from the Reports section.
          </p>
        </div>
      ) : (
        <div className="grid max-w-[840px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-[18px]">
          {cards.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(39,50,94,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-head text-[18px] font-bold tracking-[-0.01em]">
                    {r.name}
                  </div>
                  <div className="mt-[3px] text-[13px] text-muted">
                    {r.area ? `${r.area} · ` : ""}
                    {r.qCount} question{r.qCount === 1 ? "" : "s"}
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>
              <ProgressBar pct={progressFor(r.status)} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] text-muted">{r.edited}</span>
                <Link
                  href={r.href}
                  className="rounded-full bg-accent px-[18px] py-[9px] text-[13.5px] font-bold text-accent-ink transition-opacity hover:opacity-90"
                >
                  {r.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-[34px] max-w-[840px]">
        <SectionLabel className="mb-3">Previous weeks</SectionLabel>
        {previous.length === 0 ? (
          <div className="rounded-card border border-line bg-surface px-5 py-8 text-center text-[13.5px] text-muted">
            No previous reports yet — your submitted weeks will show up here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {previous.map((w, i) => (
              <div
                key={w.key}
                className={`flex items-center gap-3.5 px-5 py-3.5 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-good" aria-hidden />
                <span className="text-sm font-semibold">{w.week}</span>
                <span className="hidden text-[13px] text-muted sm:inline">
                  {w.name}
                </span>
                <span className="text-[13px] text-muted">{w.range}</span>
                <div className="flex-1" />
                <span className="text-[12.5px] text-muted">
                  Submitted {w.when}
                </span>
                <Link
                  href={w.href}
                  className="text-[13px] font-semibold text-accent"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
