import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { MarketingPage } from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Roundup — Your team's week, in one place",
  description:
    "Each lead files a short weekly update. Roundup gathers them, folds in your data, and writes the summary your senior team actually reads.",
  openGraph: {
    title: "Roundup — Your team's week, in one place",
    description:
      "Each lead files a short weekly update. Roundup gathers them, folds in your data, and writes the summary your senior team actually reads.",
    images: ["/marketing-app.png"],
  },
};

// The public marketing one-pager; signed-in users go straight to the app —
// recipients to their Roundups reading list, everyone else to My reports.
export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) {
    const me = await getSessionUser();
    redirect(me?.role === "recipient" ? "/roundups" : "/my-reports");
  }
  return <MarketingPage />;
}
