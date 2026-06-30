"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  REMINDER_TOGGLES,
  SCHEDULE_DEFAULTS,
} from "@/lib/data";

export interface Schedule {
  closeDay: string;
  closeTime: string;
  openDay: string;
  openTime: string;
}

interface SettingsState {
  schedule: Schedule;
  setSchedule: (patch: Partial<Schedule>) => void;
  reminders: Record<string, boolean>;
  toggleReminder: (key: string) => void;
}

const STORAGE_KEY = "roundup.settings";

const defaultReminders: Record<string, boolean> = Object.fromEntries(
  REMINDER_TOGGLES.map((t) => [t.key, t.on]),
);

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [schedule, setScheduleState] = useState<Schedule>(SCHEDULE_DEFAULTS);
  const [reminders, setReminders] =
    useState<Record<string, boolean>>(defaultReminders);

  // Hydrate from localStorage (UI-first persistence; replaced by the backend later).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.schedule) setScheduleState({ ...SCHEDULE_DEFAULTS, ...parsed.schedule });
        if (parsed.reminders) setReminders({ ...defaultReminders, ...parsed.reminders });
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schedule, reminders }));
    } catch {
      // ignore quota / private-mode failures
    }
  }, [schedule, reminders]);

  const setSchedule = (patch: Partial<Schedule>) =>
    setScheduleState((s) => ({ ...s, ...patch }));

  const toggleReminder = (key: string) =>
    setReminders((r) => ({ ...r, [key]: !r[key] }));

  return (
    <SettingsContext.Provider
      value={{ schedule, setSchedule, reminders, toggleReminder }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
