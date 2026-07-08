import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { DiscountsManager } from "@/components/discounts-manager";

export const dynamic = "force-dynamic";

export default async function ConsoleDiscountsPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    redirect(
      "https://www.roundup.work/login?callbackUrl=" +
        encodeURIComponent("https://console.roundup.work/"),
    );
  }
  if (!isSuperAdmin(email)) notFound();

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
        <h1 className="mb-6 font-head text-[26px] font-bold tracking-[-0.02em]">
          Discount codes
        </h1>
        <DiscountsManager />
      </main>
    </div>
  );
}
