import { useCallback, useEffect, useState } from 'react';

import { useStatsSummary } from '@/features/stats/use-stats';

import {
  cancelReminders,
  DEFAULT_REMINDERS,
  loadReminderSettings,
  remindersSupported,
  requestReminderPermission,
  saveReminderSettings,
  scheduleReminders,
  type ReminderSettings,
} from './reminders';

/** Reminder settings for this device, plus actions that keep the schedule in step. */
export function useReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const { data: summary } = useStatsSummary();
  const studiedToday = !!summary && summary.today_seconds >= summary.streak_min_seconds;
  const streak = summary?.current_streak ?? 0;

  useEffect(() => {
    let cancelled = false;
    loadReminderSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    async (next: ReminderSettings) => {
      setSettings(next);
      await saveReminderSettings(next);
      if (next.enabled) await scheduleReminders({ hour: next.hour, studiedToday, streak }).catch(() => {});
      else await cancelReminders();
    },
    [studiedToday, streak]
  );

  /** Shows the system prompt; turns reminders on only if it's allowed. */
  const enable = useCallback(
    async (hour?: number) => {
      const granted = await requestReminderPermission();
      const base = settings ?? DEFAULT_REMINDERS;
      await update({ ...base, enabled: granted, asked: true, hour: hour ?? base.hour });
      return granted;
    },
    [settings, update]
  );

  return { supported: remindersSupported, settings, update, enable };
}

/**
 * Keeps the scheduled reminders current: whenever stats change (a session ends, the app comes back), the
 * next reminder skips today if you've studied and mentions your streak. Mount once in the signed-in app.
 */
export function useReminderSync() {
  const { data: summary } = useStatsSummary();
  const studiedToday = !!summary && summary.today_seconds >= summary.streak_min_seconds;
  const streak = summary?.current_streak ?? 0;
  const ready = !!summary;

  useEffect(() => {
    if (!remindersSupported || !ready) return;
    loadReminderSettings().then((s) => {
      if (s.enabled) scheduleReminders({ hour: s.hour, studiedToday, streak }).catch(() => {});
    });
  }, [ready, studiedToday, streak]);
}
