"use client";

import { useEffect, useState } from "react";
import { useSettings } from "./settings-provider";
import { mondayISO } from "@/lib/dates";
import { closeInstant, type ScheduleSettings } from "@/lib/lifecycle";

function format(ms: number): string {
  const totalH = Math.floor(Math.max(0, ms) / 3_600_000);
  const days = Math.floor(totalH / 24);
  const hrs = totalH % 24;
  const mins = Math.floor((Math.max(0, ms) % 3_600_000) / 60_000);
  return days > 0 ? `${days}d ${hrs}h left` : `${hrs}h ${mins}m left`;
}

/** Next close instant (this week's, or next week's if this week already closed). */
function nextClose(sched: ScheduleSettings, now: Date): number {
  const thisWeek = closeInstant(mondayISO(now), sched).getTime();
  if (now.getTime() < thisWeek) return thisWeek;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 7);
  return closeInstant(mondayISO(next), sched).getTime();
}

export function DeadlinePill() {
  const { schedule } = useSettings();
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    const sched: ScheduleSettings = {
      closeDay: schedule.closeDay,
      closeTime: schedule.closeTime,
      openDay: schedule.openDay,
      openTime: schedule.openTime,
      timezone: "Europe/London",
    };
    const tick = () => {
      const now = new Date();
      setCountdown(format(nextClose(sched, now) - now.getTime()));
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [schedule]);

  return (
    <div className="flex flex-shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border border-line bg-surface px-[13px] py-[7px] text-[12.5px] text-muted">
      <span className="h-[7px] w-[7px] rounded-full bg-warn" aria-hidden />
      Closes {schedule.closeDay} {schedule.closeTime} ·{" "}
      <span className="font-semibold text-ink">{countdown || "—"}</span>
    </div>
  );
}
