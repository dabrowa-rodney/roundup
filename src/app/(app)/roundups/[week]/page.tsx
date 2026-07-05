import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, FileText } from "lucide-react";
import { db } from "@/db";
import { roundups } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { Screen } from "@/components/screen";
import { RoundupViewer } from "@/components/roundup-viewer";
import { GenerateRoundupButton } from "@/components/roundup-generate";
import { mondayISO, parseISODate, weekLabel } from "@/lib/dates";
import type { FullJson, SkimJson } from "@/lib/roundup";

export default async function RoundupViewerPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const parsed = new Date(week);
  const weekIso = isNaN(parsed.getTime())
    ? mondayISO(new Date())
    : mondayISO(parsed);

  const me = await getSessionUser();
  const isAdmin = me?.role === "admin";
  // Roundups are a leadership view — not for contributors.
  if (!me || !isAdmin) redirect("/my-reports");

  const roundup = (
    await db
      .select()
      .from(roundups)
      .where(and(eq(roundups.orgId, me.orgId), eq(roundups.weekStart, weekIso)))
      .limit(1)
  )[0];

  return (
    <Screen title="Roundup" subtitle={weekLabel(parseISODate(weekIso))}>
      {roundup?.skimJson && roundup?.fullJson ? (
        <RoundupViewer
          skim={roundup.skimJson as SkimJson}
          full={roundup.fullJson as FullJson}
          week={weekIso}
          sent={roundup.status === "sent"}
        />
      ) : (
        <NotGenerated week={weekIso} isAdmin={isAdmin} />
      )}
    </Screen>
  );
}

function NotGenerated({ week, isAdmin }: { week: string; isAdmin: boolean }) {
  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/roundups"
        className="mb-[22px] inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-[7px] text-[13px] font-semibold text-muted"
      >
        <ArrowLeft size={15} /> All roundups
      </Link>
      <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
          <FileText size={22} className="text-accent" />
        </div>
        <div className="font-head text-[20px] font-bold">
          No Roundup generated yet
        </div>
        <p className="mx-auto mb-5 mt-1.5 max-w-[440px] text-[14px] text-muted">
          Compile this week&apos;s submitted reports into a Roundup summary —
          risks, highlights, key metrics and a per-team rundown.
        </p>
        {isAdmin ? (
          <div className="flex justify-center">
            <GenerateRoundupButton week={week} />
          </div>
        ) : (
          <p className="text-[13px] text-muted">
            An administrator can generate it once reports are in.
          </p>
        )}
      </div>
    </div>
  );
}
