// Browsers can't show reminders while the tab is closed (that needs web push and a server), so reminders
// are a phone-app feature. These stand-ins keep the same shape as reminders.ts.
export const remindersSupported = false;

export type ReminderSettings = { enabled: boolean; hour: number; asked: boolean };

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, hour: 19, asked: true };

export async function loadReminderSettings(): Promise<ReminderSettings> {
  return DEFAULT_REMINDERS;
}

export async function saveReminderSettings(_settings: ReminderSettings) {}

export async function requestReminderPermission() {
  return false;
}

export async function scheduleReminders(_options: { hour: number; studiedToday: boolean; streak: number }) {}

export async function cancelReminders() {}
