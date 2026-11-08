// Phones: a local reminder on days you haven't studied yet. Local notifications are scheduled on the
// device itself, so there's no server and nothing to pay for. See reminders.web.ts for browsers.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AndroidImportance,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Platform } from 'react-native';

export const remindersSupported = true;

export type ReminderSettings = {
  enabled: boolean;
  /** Local hour, 0–23. */
  hour: number;
  /** Whether we've asked once already (the soft ask after the first win). */
  asked: boolean;
};

const KEY = 'reminders.settings';
const CHANNEL = 'reminders';
export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, hour: 19, asked: false };
/** Remind on the next few days, so a few days away from the app still gets a nudge. */
const DAYS_AHEAD = 3;

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    return saved ? { ...DEFAULT_REMINDERS, ...(JSON.parse(saved) as Partial<ReminderSettings>) } : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => {});
}

/** Asks the system for permission (the real prompt). Returns whether reminders can be shown. */
export async function requestReminderPermission() {
  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await setNotificationChannelAsync(CHANNEL, {
      name: 'Study reminders',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const current = await getPermissionsAsync();
  if (current.granted) return true;
  const asked = await requestPermissionsAsync();
  return asked.granted;
}

/**
 * Replaces the scheduled reminders with fresh ones: at `hour` on each of the next few days, skipping today
 * if you've already studied (or the hour has passed). Called whenever stats change.
 */
export async function scheduleReminders({ hour, studiedToday, streak }: { hour: number; studiedToday: boolean; streak: number }) {
  await cancelAllScheduledNotificationsAsync();
  const now = new Date();
  let added = 0;
  for (let offset = 0; added < DAYS_AHEAD && offset <= DAYS_AHEAD; offset++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, 0, 0);
    if (at <= now || (offset === 0 && studiedToday)) continue;
    const first = added === 0;
    await scheduleNotificationAsync({
      content: {
        title: first && streak > 0 ? `Keep your ${streak}-day streak going` : 'Time for a study session',
        body: 'Even a short session counts. Start one now.',
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: Platform.OS === 'android' ? CHANNEL : undefined,
      },
    });
    added++;
  }
}

export async function cancelReminders() {
  await cancelAllScheduledNotificationsAsync();
}
