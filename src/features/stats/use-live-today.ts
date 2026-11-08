import { computeTimer } from '@/features/timer/engine';
import { useServerNow } from '@/hooks/use-server-now';
import { useActiveSession } from '@/providers/active-session-provider';

import type { StatsSummary } from './use-stats';

/**
 * Today's numbers including a session that's still running (the server summary only counts finished
 * sessions). Ticks every second while a session runs.
 */
export function useLiveToday(summary: StatsSummary | null) {
  const { session, pauses, offsetMs } = useActiveSession();
  const now = useServerNow(offsetMs, !!session);
  const runningSeconds = session ? computeTimer(session, pauses, now).focusedSeconds : 0;

  const saved = summary?.today_seconds ?? 0;
  const todaySeconds = saved + runningSeconds;
  const min = summary?.streak_min_seconds ?? 60;
  // If today wasn't counted yet but the running session gets it over the line, the streak grows by one.
  const streak = summary ? summary.current_streak + (saved < min && todaySeconds >= min ? 1 : 0) : 0;
  const week = (summary?.week ?? []).map((d) =>
    d.day === summary?.today ? { ...d, seconds: d.seconds + runningSeconds } : d
  );

  return { todaySeconds, streak, studiedToday: todaySeconds >= min, week, minSeconds: min };
}
