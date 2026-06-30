"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

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
  saving: boolean;
  loaded: boolean;
}

const DEFAULTS: Schedule = {
  closeDay: "Sunday",
  closeTime: "20:00",
  openDay: "Monday",
  openTime: "01:00",
};

const DEFAULT_REMINDERS: Record<string, boolean> = {
  friday: true,
  sunday: true,
  ready: false,
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [schedule, setScheduleState] = useState<Schedule>(DEFAULTS);
  const [reminders, setReminders] = useState<Record<string, boolean>>(DEFAULT_REMINDERS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load settings from API on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          const s = data.settings;
          setScheduleState({
            closeDay: s.closeDay || DEFAULTS.closeDay,
            closeTime: s.closeTime || DEFAULTS.closeTime,
            openDay: s.openDay || DEFAULTS.openDay,
            openTime: s.openTime || DEFAULTS.openTime,
          });
          setReminders({
            friday: s.reminderFriday ?? DEFAULT_REMINDERS.friday,
            sunday: s.reminderSunday ?? DEFAULT_REMINDERS.sunday,
            ready: s.reminderRoundupReady ?? DEFAULT_REMINDERS.ready,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Persist to API (debounced via the callers)
  const persistToApi = useCallback(
    async (newSchedule: Schedule, newReminders: Record<string, boolean>) => {
      setSaving(true);
      try {
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            closeDay: newSchedule.closeDay,
            closeTime: newSchedule.closeTime,
            openDay: newSchedule.openDay,
            openTime: newSchedule.openTime,
            reminderFriday: newReminders.friday,
            reminderSunday: newReminders.sunday,
            reminderRoundupReady: newReminders.ready,
          }),
        });
      } catch {
        // silently fail — settings will be re-fetched on next load
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const setSchedule = useCallback(
    (patch: Partial<Schedule>) => {
      setScheduleState((prev) => {
        const next = { ...prev, ...patch };
        persistToApi(next, reminders);
        return next;
      });
    },
    [reminders, persistToApi],
  );

  const toggleReminder = useCallback(
    (key: string) => {
      setReminders((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        persistToApi(schedule, next);
        return next;
      });
    },
    [schedule, persistToApi],
  );

  return (
    <SettingsContext.Provider
      value={{ schedule, setSchedule, reminders, toggleReminder, saving, loaded }}
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
