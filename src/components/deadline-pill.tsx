"use client";

import { useEffect, useState } from "react";
import { DEADLINE_HOURS_AHEAD } from "@/lib/data";
import { useSettings } from "./settings-provider";

function format(ms: number): string {
  const totalH = Math.floor(Math.max(0, ms) / 3_600_000);
  const days = Math.floor(totalH / 24);
  const hrs = totalH % 24;
  const mins = Math.floor((Math.max(0, ms) % 3_600_000) / 60_000);
  return days > 0 ? `${days}d ${hrs}h left` : `${hrs}h ${mins}m left`;
}

export function DeadlinePill() {
  const { schedule } = useSettings();
  const [target, setTarget] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  // Seed the countdown on the client only (avoids hydration mismatch).
  useEffect(() => {
    const start = Date.now();
    setTarget(start + DEADLINE_HOURS_AHEAD * 3_600_000);
    setNow(start);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const countdown = target !== null && now !== null ? format(target - now) : "";

  return (
    <div className="flex flex-shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border border-line bg-surface px-[13px] py-[7px] text-[12.5px] text-muted">
      <span className="h-[7px] w-[7px] rounded-full bg-warn" aria-hidden />
      Closes {schedule.closeDay} {schedule.closeTime} ·{" "}
      <span className="font-semibold text-ink">{countdown || "—"}</span>
    </div>
  );
}
