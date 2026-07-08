"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Database,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Table,
  Users,
  X,
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
  {
    href: "/data-sources",
    label: "Data sources",
    icon: Database,
    match: ["/data-sources"],
  },
  { href: "/roundups", label: "Roundups", icon: Table, match: ["/roundups"] },
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
      className={`mb-0.5 flex items-center gap-2.5 rounded-[10px] px-3 py-[9px] text-[13.5px] transition-colors ${
        active
          ? "bg-accent-soft font-semibold text-accent"
          : "font-medium text-muted hover:text-accent"
      }`}
    >
      <Icon size={16} strokeWidth={2} />
      {item.label}
    </Link>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/roundup-icon.svg" alt="" className="h-6 w-6" />
      <span className="font-head text-[17px] font-bold tracking-[-0.01em]">
        Roundup
      </span>
    </div>
  );
}

/** Nav sections + user footer — shared by the desktop aside and the drawer. */
function SidebarContent() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const role = (session?.user as { role?: string } | undefined)?.role;
  const name = session?.user?.name ?? "User";
  const roleLabel = role ? (ROLE_LABEL[role] ?? "Member") : "Member";
  const isAdmin = role === "admin";

  // Flat list per the dashboard-restyle handoff — no section headers.
  const items = isAdmin ? [...THIS_WEEK, ...ADMIN, SETTINGS_ITEM] : [...THIS_WEEK, SETTINGS_ITEM];

  return (
    <>
      {items.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
      ))}

      <div className="flex-1" />

      <div className="mt-3 flex items-center gap-2.5 border-t border-line px-2 pb-1 pt-3.5">
        <Avatar name={name} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-ink">{name}</div>
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
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating closes the drawer.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[216px] flex-shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-2 pb-5 pt-0.5">
          <Brand />
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-accent-soft"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface px-4 py-[22px] shadow-xl">
            <div className="flex items-center justify-between px-2 pb-[22px] pt-1">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-accent-soft"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
