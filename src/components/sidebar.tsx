"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Database,
  FileText,
  LayoutGrid,
  LogOut,
  Settings,
  Table,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "./ui";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Route prefixes that should mark this item active. */
  match: string[];
}

const THIS_WEEK: NavItem[] = [
  {
    href: "/my-reports",
    label: "My reports",
    icon: LayoutGrid,
    match: ["/my-reports"],
  },
];

const ADMIN: NavItem[] = [
  { href: "/reports", label: "Reports", icon: FileText, match: ["/reports"] },
  { href: "/team", label: "Team", icon: Users, match: ["/team"] },
  { href: "/roundups", label: "Roundups", icon: Table, match: ["/roundups"] },
  {
    href: "/data-sources",
    label: "Data sources",
    icon: Database,
    match: ["/data-sources"],
  },
];

const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
  match: ["/settings"],
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  contributor: "Contributor",
  recipient: "Recipient",
};

function isActive(pathname: string, item: NavItem): boolean {
  return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`mb-0.5 flex items-center gap-[11px] rounded-[11px] px-3 py-2.5 text-sm transition-colors hover:bg-accent-soft ${
        active
          ? "bg-accent-soft font-bold text-accent"
          : "font-semibold text-muted"
      }`}
    >
      <Icon size={17} strokeWidth={2} />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const role = (session?.user as { role?: string } | undefined)?.role;
  const name = session?.user?.name ?? "User";
  const roleLabel = role ? (ROLE_LABEL[role] ?? "Member") : "Member";
  const isAdmin = role === "admin";

  return (
    <aside className="sticky top-0 flex h-screen w-[248px] flex-shrink-0 flex-col border-r border-line bg-surface px-4 py-[22px]">
      <div className="flex items-center gap-2.5 px-2 pb-[22px] pt-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent font-head text-[17px] font-extrabold text-accent-ink">
          R
        </div>
        <span className="text-[17px] font-bold tracking-[-0.01em]">Roundup</span>
      </div>

      <div className="px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] text-muted">
        THIS WEEK
      </div>
      {THIS_WEEK.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
      ))}

      {isAdmin && (
        <>
          <div className="flex items-center gap-[7px] px-3 pb-1.5 pt-[18px] text-[11px] font-bold tracking-[0.08em] text-muted">
            ADMIN
            <span className="rounded-md bg-accent-soft px-[7px] py-0.5 text-[10px] font-semibold tracking-normal text-accent">
              You can manage
            </span>
          </div>
          {ADMIN.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item)}
            />
          ))}
        </>
      )}

      <div className="flex-1" />

      <NavLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM)} />

      <div className="mt-3 flex items-center gap-2.5 border-t border-line px-2.5 pb-1 pt-3">
        <Avatar name={name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{name}</div>
          <div className="text-[11px] text-muted">{roleLabel}</div>
        </div>
        {session && (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}
