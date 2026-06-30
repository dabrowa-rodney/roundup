import Link from "next/link";
import { Check } from "lucide-react";
import { Screen } from "@/components/screen";
import { SectionLabel } from "@/components/ui";
import { CURRENT_USER, SUBMITTED_ANSWERS, WEEK_LABEL } from "@/lib/data";

const firstName = CURRENT_USER.name.split(" ")[0];

export default async function SubmittedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Screen title="Report submitted" subtitle={WEEK_LABEL}>
      <div className="mx-auto max-w-[680px]">
        <div className="rounded-card border border-line bg-surface p-10 text-center">
          <div className="mx-auto mb-[18px] flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
            <Check size={30} strokeWidth={2.5} className="text-accent" />
          </div>
          <div className="font-head text-[24px] font-bold tracking-[-0.02em]">
            Report submitted
          </div>
          <p className="mt-2 text-[15px] text-muted">
            Thanks, {firstName} — your Customer Success update for {WEEK_LABEL} is
            in. It&apos;ll feed into this Sunday&apos;s Roundup.
          </p>
          <div className="mt-[22px] flex flex-wrap justify-center gap-[11px]">
            <Link
              href={`/my-reports/${id}`}
              className="rounded-[11px] border border-line bg-surface px-5 py-[11px] text-sm font-semibold text-ink"
            >
              Edit my answers
            </Link>
            <Link
              href="/my-reports"
              className="rounded-[11px] bg-accent px-5 py-[11px] text-sm font-bold text-accent-ink"
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
          {SUBMITTED_ANSWERS.map((a) => (
            <div key={a.q} className="border-t border-line py-3.5">
              <div className="mb-1 text-[13px] text-muted">{a.q}</div>
              <div className="text-[14.5px] leading-[1.55]">{a.a}</div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
