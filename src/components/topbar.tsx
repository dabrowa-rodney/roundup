"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Settings, Table } from "lucide-react";
import { Avatar } from "./ui";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  contributor: "Contributor",
  recipient: "Recipient",
};

/**
 * Slim top bar used instead of the sidebar for contributors/recipients —
 * they only complete reports, so the app chrome stays out of the way.
 * Logo goes home (My reports); Settings, identity and sign-out sit right.
 */
export function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const role = (session?.user as { role?: string } | undefined)?.role;
  const name = session?.user?.name ?? "User";
  const roleLabel = role ? (ROLE_LABEL[role] ?? "Member") : "Member";
  const onSettings =
    pathname === "/settings" || pathname.startsWith("/settings/");
  const onRoundups =
    pathname === "/roundups" || pathname.startsWith("/roundups/");

  // A recipient's home is the Roundups reading list; contributors' is
  // their reports.
  const home = role === "recipient" ? "/roundups" : "/my-reports";

  return (
    <header className="flex h-[58px] flex-shrink-0 items-center gap-3 border-b border-line bg-surface px-5 sm:px-8">
      <Link href={home} className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/roundup-icon.svg" alt="" className="h-6 w-6" />
        <span className="font-head text-[17px] font-bold tracking-[-0.01em]">
          Roundup
        </span>
      </Link>

      <div className="flex-1" />

      {role === "recipient" && (
        <Link
          href="/roundups"
          aria-current={onRoundups ? "page" : undefined}
          className={`flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[13px] transition-colors ${
            onRoundups
              ? "bg-accent-soft font-semibold text-accent"
              : "font-medium text-muted hover:text-accent"
          }`}
        >
          <Table size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Roundups</span>
        </Link>
      )}

      <Link
        href="/settings"
        aria-current={onSettings ? "page" : undefined}
        className={`flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[13px] transition-colors ${
          onSettings
            ? "bg-accent-soft font-semibold text-accent"
            : "font-medium text-muted hover:text-accent"
        }`}
      >
        <Settings size={15} strokeWidth={2} />
        <span className="hidden sm:inline">Settings</span>
      </Link>

      <div className="flex items-center gap-2.5 border-l border-line pl-3.5">
        <Avatar name={name} size={28} />
        <div className="hidden min-w-0 sm:block">
          <div className="max-w-[160px] truncate text-[12.5px] font-medium leading-tight text-ink">
            {name}
          </div>
          <div className="text-[11px] leading-tight text-muted">{roleLabel}</div>
        </div>
        {session && (
          <button
            onClick={() =>
              signOut({ callbackUrl: "/api/auth/signout-complete" })
            }
            aria-label="Sign out"
            title="Sign out"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </header>
  );
}
