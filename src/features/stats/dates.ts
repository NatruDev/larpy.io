// Calendar-day helpers on 'YYYY-MM-DD' strings. Days come from the server already in the user's time
// zone, so the math here is pure date math (done in UTC to avoid the device's own zone shifting it).

const MS_PER_DAY = 86_400_000;

function toUtc(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number) {
  return fromUtc(toUtc(day) + days * MS_PER_DAY);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(day: string) {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7;
}

export function startOfWeek(day: string) {
  return addDays(day, -weekdayIndex(day));
}

export function startOfMonth(day: string) {
  return `${day.slice(0, 7)}-01`;
}

/** "Oct" */
export function monthShort(day: string) {
  return new Date(toUtc(day)).toLocaleDateString([], { month: 'short', timeZone: 'UTC' });
}

/** "Tue, Oct 21" */
export function dayLong(day: string) {
  return new Date(toUtc(day)).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "October 2026" */
export function monthLong(day: string) {
  return new Date(toUtc(day)).toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
