import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ArrowLeft, FileText } from "lucide-react";
import { db } from "@/db";
import { reportInstances, roundups } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { Screen } from "@/components/screen";
import { RoundupViewer } from "@/components/roundup-viewer";
import { GenerateRoundupButton } from "@/components/roundup-generate";
import { mondayISO } from "@/lib/dates";
import { ensureRootTeam } from "@/lib/teams";
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
  // Admins manage roundups; recipients may read sent ones. Contributors
  // have no roundup access.
  if (!me || (!isAdmin && me.role !== "recipient")) redirect("/my-reports");

  // Org-level viewer: the ROOT team's weekly roundup for this week.
  const rootTeamId = await ensureRootTeam(me.orgId);
  const roundup = (
    await db
      .select()
      .from(roundups)
      .where(
        and(eq(roundups.teamId, rootTeamId), eq(roundups.weekStart, weekIso)),
      )
      .limit(1)
  )[0];

  // Recipients only ever see the distributed version — drafts and previews
  // stay with admins.
  if (!isAdmin && roundup?.status !== "sent") redirect("/roundups");

  // Generation compiles submitted/locked reports — with none, there is
  // nothing to preview, so the button is withheld (the API refuses too).
  const submittedCount = roundup
    ? 1
    : ((
        await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reportInstances)
          .where(
            and(
              eq(reportInstances.orgId, me.orgId),
              eq(reportInstances.weekStart, weekIso),
              inArray(reportInstances.status, ["submitted", "locked"]),
            ),
          )
      )[0]?.count ?? 0);

  return (
    <Screen>
      {roundup?.skimJson && roundup?.fullJson ? (
        <RoundupViewer
          skim={roundup.skimJson as SkimJson}
          full={roundup.fullJson as FullJson}
          week={weekIso}
          sent={roundup.status === "sent"}
          canManage={isAdmin}
        />
      ) : (
        <NotGenerated
          week={weekIso}
          isAdmin={isAdmin}
          hasReports={submittedCount > 0}
        />
      )}
    </Screen>
  );
}

function NotGenerated({
  week,
  isAdmin,
  hasReports,
}: {
  week: string;
  isAdmin: boolean;
  hasReports: boolean;
}) {
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
        {isAdmin && hasReports ? (
          <div className="flex justify-center">
            <GenerateRoundupButton week={week} />
          </div>
        ) : isAdmin ? (
          <p className="text-[13px] font-medium text-muted">
            No reports have been submitted for this week yet — generating
            unlocks once the first one is in.
          </p>
        ) : (
          <p className="text-[13px] text-muted">
            An administrator can generate it once reports are in.
          </p>
        )}
      </div>
    </div>
  );
}
