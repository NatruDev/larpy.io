import { addDays, startOfWeek } from '@/features/stats/dates';
import { useLiveQuery, useStatsSummary, type RecentSession } from '@/features/stats/use-stats';
import { computeTimer } from '@/features/timer/engine';
import { useServerNow } from '@/hooks/use-server-now';
import { localReady, localSessionsSince } from '@/features/local/local-store';
import { LOCAL_MODE } from '@/lib/backend';
import { supabase } from '@/lib/supabase';
import { useActiveSession } from '@/providers/active-session-provider';

export type TimelineItem = {
  id: string;
  subjectName: string | null;
  /** Stored subject color (light value); run through `subjectColor` before drawing */
  color: string | null;
  startMs: number;
  /** Now, for the running session */
  endMs: number;
  focusedSeconds: number;
  goalMinutes: number | null;
  isPomodoro: boolean;
  isPrivate: boolean;
  isManual: boolean;
  caption: string | null;
  live: boolean;
};

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** The 'YYYY-MM-DD' day an instant falls on in `timeZone`. */
export function localDay(ms: number, timeZone: string) {
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormats.set(timeZone, format);
  }
  return format.format(ms);
}

/** "8:30 AM" (or "08:30", following the device locale) in `timeZone`. */
export function clockIn(ms: number, timeZone: string) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone });
}

/**
 * This week's sessions (Mon–Sun, the user's local days) grouped by day, including the running one.
 * Ticks every second while a session runs so its capsule grows.
 */
export function useWeekTimeline() {
  const { data: summary } = useStatsSummary();
  const { session: active, pauses, offsetMs } = useActiveSession();
  const now = useServerNow(offsetMs, !!active);
  const today = summary?.today ?? null;
  const timeZone = summary?.time_zone ?? 'UTC';
  const monday = today ? startOfWeek(today) : null;

  const { data: sessions } = useLiveQuery(async (userId) => {
    if (!monday) return [] as RecentSession[];
    if (LOCAL_MODE) {
      await localReady();
      return localSessionsSince(`${addDays(monday, -1)}T00:00:00Z`);
    }
    // A day early in UTC covers every time zone; trimmed to local days below.
    const { data, error } = await supabase
      .from('sessions')
      .select('*, subject:subjects(id, name, color)')
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .gte('started_at', `${addDays(monday, -1)}T00:00:00Z`)
      .order('started_at');
    if (error) throw error;
    return (data ?? []) as RecentSession[];
  }, `week:${monday}`);

  const days = monday ? Array.from({ length: 7 }, (_, i) => addDays(monday, i)) : [];
  const byDay = new Map<string, TimelineItem[]>(days.map((d) => [d, []]));

  const toItem = (s: RecentSession, live: boolean): TimelineItem => ({
    id: s.id,
    subjectName: s.subject?.name ?? null,
    color: s.subject?.color ?? null,
    startMs: Date.parse(s.started_at),
    endMs: live || !s.ended_at ? now : Date.parse(s.ended_at),
    focusedSeconds: live ? computeTimer(s, pauses, now).focusedSeconds : (s.focused_seconds ?? 0),
    goalMinutes: s.goal_minutes,
    isPomodoro: !!s.pomodoro_focus_minutes,
    isPrivate: s.is_private,
    isManual: s.source === 'manual',
    caption: s.caption,
    live,
  });

  for (const s of sessions ?? []) byDay.get(localDay(Date.parse(s.started_at), timeZone))?.push(toItem(s, false));
  if (active) byDay.get(localDay(Date.parse(active.started_at), timeZone))?.push(toItem(active, true));

  return { today, timeZone, days, byDay, summary, isLoading: !summary || !sessions };
}
