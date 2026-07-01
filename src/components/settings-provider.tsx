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

export interface ReminderSlot {
  enabled: boolean;
  day: string;
  time: string;
}

export interface Reminders {
  r1: ReminderSlot;
  r2: ReminderSlot;
  roundupReady: boolean;
}

interface SettingsState {
  schedule: Schedule;
  setSchedule: (patch: Partial<Schedule>) => void;
  reminders: Reminders;
  setReminderSlot: (which: "r1" | "r2", patch: Partial<ReminderSlot>) => void;
  setRoundupReady: (on: boolean) => void;
  saving: boolean;
  loaded: boolean;
}

const DEFAULTS: Schedule = {
  closeDay: "Sunday",
  closeTime: "20:00",
  openDay: "Monday",
  openTime: "01:00",
};

const DEFAULT_REMINDERS: Reminders = {
  r1: { enabled: true, day: "Thursday", time: "13:00" },
  r2: { enabled: true, day: "Friday", time: "09:00" },
  roundupReady: false,
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [schedule, setScheduleState] = useState<Schedule>(DEFAULTS);
  const [reminders, setReminders] = useState<Reminders>(DEFAULT_REMINDERS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load settings from the API on mount.
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
            r1: {
              enabled: s.reminder1Enabled ?? DEFAULT_REMINDERS.r1.enabled,
              day: s.reminder1Day || DEFAULT_REMINDERS.r1.day,
              time: s.reminder1Time || DEFAULT_REMINDERS.r1.time,
            },
            r2: {
              enabled: s.reminder2Enabled ?? DEFAULT_REMINDERS.r2.enabled,
              day: s.reminder2Day || DEFAULT_REMINDERS.r2.day,
              time: s.reminder2Time || DEFAULT_REMINDERS.r2.time,
            },
            roundupReady: s.reminderRoundupReady ?? DEFAULT_REMINDERS.roundupReady,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const persistToApi = useCallback(
    async (newSchedule: Schedule, newReminders: Reminders) => {
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
            reminder1Enabled: newReminders.r1.enabled,
            reminder1Day: newReminders.r1.day,
            reminder1Time: newReminders.r1.time,
            reminder2Enabled: newReminders.r2.enabled,
            reminder2Day: newReminders.r2.day,
            reminder2Time: newReminders.r2.time,
            reminderRoundupReady: newReminders.roundupReady,
          }),
        });
      } catch {
        // silently fail — settings re-fetch on next load
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

  const setReminderSlot = useCallback(
    (which: "r1" | "r2", patch: Partial<ReminderSlot>) => {
      setReminders((prev) => {
        const next = { ...prev, [which]: { ...prev[which], ...patch } };
        persistToApi(schedule, next);
        return next;
      });
    },
    [schedule, persistToApi],
  );

  const setRoundupReady = useCallback(
    (on: boolean) => {
      setReminders((prev) => {
        const next = { ...prev, roundupReady: on };
        persistToApi(schedule, next);
        return next;
      });
    },
    [schedule, persistToApi],
  );

  return (
    <SettingsContext.Provider
      value={{
        schedule,
        setSchedule,
        reminders,
        setReminderSlot,
        setRoundupReady,
        saving,
        loaded,
      }}
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
