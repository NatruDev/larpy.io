/** "30 min", "1 h", "1 h 30 min" */
export function formatGoal(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Compact lengths for tight spots: "25m", "1h", "1h 15m". */
export function formatGoalShort(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)}h ${rest}m` : `${minutes / 60}h`;
}

/** Timer digits: "4:05", "25:00", "1:05:09" */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}

/** Spoken-style length: "45s", "25m", "1h 5m" */
export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Local clock time: "3:13 PM" */
export function formatTimeOfDay(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Big totals stay short: "226h" from 100 hours up, otherwise like formatDuration. */
export function formatTotal(totalSeconds: number) {
  return totalSeconds >= 100 * 3600 ? `${Math.floor(totalSeconds / 3600)}h` : formatDuration(totalSeconds);
}

/** Feed timestamps: "just now", "5m ago", "3h ago", "2d ago", then "Oct 12" */
export function formatTimeAgo(iso: string, nowMs = Date.now()) {
  const seconds = Math.max(0, nowMs - Date.parse(iso)) / 1000;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
