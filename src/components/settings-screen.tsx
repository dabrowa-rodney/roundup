"use client";

import { signOut, useSession } from "next-auth/react";
import { Avatar } from "./ui";
import { useSettings, type Schedule } from "./settings-provider";
import {
  CURRENT_USER,
  DAYS,
  RECIPIENTS,
  REMINDER_TOGGLES,
  TIMES,
} from "@/lib/data";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-card border border-line bg-surface px-[26px] py-6">
      {children}
    </div>
  );
}

function CardTitle({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  return (
    <div className="font-head text-[16px] font-bold">
      {children}
      {admin && (
        <span className="ml-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
          Admin
        </span>
      )}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`flex h-6 w-[42px] cursor-pointer rounded-full p-[3px] transition-colors ${
        on ? "justify-end bg-accent" : "justify-start bg-line"
      }`}
    >
      <span className="h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
    </button>
  );
}

const selectClass =
  "rounded-[9px] border border-line bg-bg px-[11px] py-[9px] font-head text-[15px] font-bold text-ink cursor-pointer";

function DayTime({
  dayValue,
  timeValue,
  onDay,
  onTime,
}: {
  dayValue: string;
  timeValue: string;
  onDay: (v: string) => void;
  onTime: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <select
        value={dayValue}
        onChange={(e) => onDay(e.target.value)}
        className={`flex-1 ${selectClass}`}
      >
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={timeValue}
        onChange={(e) => onTime(e.target.value)}
        className={selectClass}
      >
        {TIMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SettingsScreen() {
  const { schedule, setSchedule, reminders, toggleReminder } = useSettings();
  const { data: session } = useSession();
  const set = (patch: Partial<Schedule>) => setSchedule(patch);

  const name = session?.user?.name ?? CURRENT_USER.name;
  const email = session?.user?.email ?? CURRENT_USER.email;

  return (
    <div className="max-w-[720px]">
      {/* Account */}
      <Card>
        <div className="mb-4">
          <CardTitle>Account</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <Avatar name={name} size={48} />
          <div>
            <div className="text-[15px] font-semibold">{name}</div>
            <div className="text-[13px] text-muted">{email}</div>
          </div>
          <div className="flex-1" />
          <span className="flex items-center gap-[7px] text-[13px] font-semibold text-good">
            <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden>
              <path
                fill="currentColor"
                d="M44 24c0-1.3-.1-2.6-.4-3.9H24v7.4h11.3a9.7 9.7 0 0 1-4.2 6.4v5.3h6.8C41.9 35.6 44 30.3 44 24z"
              />
            </svg>
            Google connected
          </span>
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-[10px] border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-accent"
            >
              Sign out
            </button>
          )}
        </div>
      </Card>

      {/* Weekly schedule */}
      <Card>
        <CardTitle admin>Weekly schedule</CardTitle>
        <p className="mb-4 mt-1.5 text-[13.5px] text-muted">
          When reports lock and reopen. Times are London (GMT/BST).
        </p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="rounded-xl border border-line p-4">
            <div className="mb-[9px] text-[12.5px] text-muted">Closes</div>
            <DayTime
              dayValue={schedule.closeDay}
              timeValue={schedule.closeTime}
              onDay={(v) => set({ closeDay: v })}
              onTime={(v) => set({ closeTime: v })}
            />
          </div>
          <div className="rounded-xl border border-line p-4">
            <div className="mb-[9px] text-[12.5px] text-muted">
              Reopens (clean report)
            </div>
            <DayTime
              dayValue={schedule.openDay}
              timeValue={schedule.openTime}
              onDay={(v) => set({ openDay: v })}
              onTime={(v) => set({ openTime: v })}
            />
          </div>
        </div>
      </Card>

      {/* Reminders */}
      <Card>
        <div className="mb-3.5">
          <CardTitle>Reminders</CardTitle>
        </div>
        {REMINDER_TOGGLES.map((t) => (
          <div
            key={t.key}
            className="flex items-center gap-3.5 border-t border-line py-3"
          >
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="text-[12.5px] text-muted">{t.desc}</div>
            </div>
            <Toggle
              on={reminders[t.key]}
              onClick={() => toggleReminder(t.key)}
            />
          </div>
        ))}
      </Card>

      {/* Recipients */}
      <div className="rounded-card border border-line bg-surface px-[26px] py-6">
        <CardTitle admin>Roundup recipients</CardTitle>
        <p className="mb-3.5 mt-1.5 text-[13.5px] text-muted">
          Who receives the generated summary each week.
        </p>
        <div className="flex flex-wrap gap-2">
          {RECIPIENTS.map((name) => (
            <span
              key={name}
              className="flex items-center gap-2 rounded-full border border-line py-1.5 pl-1.5 pr-3 text-[13px]"
            >
              <Avatar name={name} size={24} />
              {name}
            </span>
          ))}
          <button className="rounded-full border border-dashed border-line px-3.5 py-1.5 text-[13px] font-semibold text-muted">
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
