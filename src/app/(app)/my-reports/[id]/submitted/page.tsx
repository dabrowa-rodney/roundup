import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Check } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  answers,
  questions,
  reportInstances,
  reportTemplates,
  users,
} from "@/db/schema";
import { Screen } from "@/components/screen";
import { SectionLabel } from "@/components/ui";
import { formatAnswer, parseConfig } from "@/lib/questions";
import { mondayISO, parseISODate, weekLabel } from "@/lib/dates";

export default async function SubmittedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId)) notFound();

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/login");
  const firstName = (session?.user?.name ?? "there").split(" ")[0];

  const me = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
  )[0];
  if (!me) redirect("/login");

  const template = (
    await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.id, templateId))
      .limit(1)
  )[0];
  if (!template) notFound();

  const weekIso = mondayISO(new Date());
  const weekStartDate = parseISODate(weekIso);
  const instance = (
    await db
      .select()
      .from(reportInstances)
      .where(
        and(
          eq(reportInstances.templateId, templateId),
          eq(reportInstances.userId, me.id),
          eq(reportInstances.weekStart, weekIso),
        ),
      )
      .limit(1)
  )[0];

  // Only show the confirmation once submitted; otherwise send back to the form.
  if (
    !instance ||
    (instance.status !== "submitted" && instance.status !== "locked")
  ) {
    redirect(`/my-reports/${templateId}`);
  }

  const qs = await db
    .select()
    .from(questions)
    .where(
      and(eq(questions.templateId, templateId), isNull(questions.archivedAt)),
    )
    .orderBy(asc(questions.order));

  const ans = await db
    .select()
    .from(answers)
    .where(eq(answers.instanceId, instance.id));
  const valueByQ = new Map(ans.map((a) => [a.questionId, a.value]));

  const summary = qs.map((q) => ({
    id: q.id,
    q: q.text,
    a: formatAnswer(q.type, valueByQ.get(q.id), parseConfig(q.config)),
  }));

  return (
    <Screen title="Report submitted" subtitle={weekLabel(weekStartDate)}>
      <div className="mx-auto max-w-[680px]">
        <div className="rounded-card border border-line bg-surface p-10 text-center">
          <div className="mx-auto mb-[18px] flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
            <Check size={30} strokeWidth={2.5} className="text-accent" />
          </div>
          <div className="font-head text-[24px] font-bold tracking-[-0.02em]">
            Report submitted
          </div>
          <p className="mt-2 text-[15px] text-muted">
            Thanks, {firstName} — your {template.name} update for{" "}
            {weekLabel(weekStartDate)} is in. It&apos;ll feed into this week&apos;s
            Roundup.
          </p>
          <div className="mt-[22px] flex flex-wrap justify-center gap-[11px]">
            <Link
              href={`/my-reports/${templateId}`}
              className="rounded-full border border-line bg-surface px-5 py-[11px] text-sm font-semibold text-ink"
            >
              Edit my answers
            </Link>
            <Link
              href="/my-reports"
              className="rounded-full bg-accent px-5 py-[11px] text-sm font-bold text-accent-ink"
            >
              Back to my reports
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="rounded-card border border-line bg-surface px-5 py-[18px]">
            <SectionLabel className="tracking-[0.05em]">Still open</SectionLabel>
            <div className="mt-1.5 text-[14.5px] font-semibold">
              You can edit until Sunday 20:00
            </div>
            <div className="mt-[3px] text-[13px] text-muted">
              Make changes any time before the window closes.
            </div>
          </div>
          <div className="rounded-card border border-line bg-surface px-5 py-[18px]">
            <SectionLabel className="tracking-[0.05em]">Next week</SectionLabel>
            <div className="mt-1.5 text-[14.5px] font-semibold">
              A fresh report opens Monday 01:00
            </div>
            <div className="mt-[3px] text-[13px] text-muted">
              Clean and empty, ready to fill in.
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-card border border-line bg-surface px-6 py-2">
          <SectionLabel className="py-4 tracking-[0.05em]">
            Your answers
          </SectionLabel>
          {summary.length === 0 ? (
            <div className="border-t border-line py-4 text-[13.5px] text-muted">
              This report has no questions.
            </div>
          ) : (
            summary.map((a) => (
              <div key={a.id} className="border-t border-line py-3.5">
                <div className="mb-1 text-[13px] text-muted">{a.q}</div>
                <div className="text-[14.5px] leading-[1.55]">{a.a}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </Screen>
  );
}
