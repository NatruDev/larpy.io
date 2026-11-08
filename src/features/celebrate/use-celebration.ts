import { useStatsSummary, type StatsSummary } from '@/features/stats/use-stats';
import type { Session } from '@/lib/types';

export type Celebration = {
  summary: StatsSummary;
  streak: number;
  /** This session made today count, so the streak went up by one (or started). */
  extended: boolean;
  /** The current streak is the longest so far (and at least 2 days). */
  bestYet: boolean;
  /** Today's total crossed the daily goal with this session. */
  dailyGoalHit: boolean;
  sessionGoalHit: boolean;
};

/**
 * What a just-finished session earned, worked out from the stats after it was saved. Null while the stats
 * load. Days are the user's local days, as everywhere else.
 */
export function useCelebration(session: Pick<Session, 'focused_seconds' | 'goal_minutes'>): Celebration | null {
  const { data: summary, isLoading } = useStatsSummary();
  if (!summary || isLoading) return null;

  const focused = session.focused_seconds ?? 0;
  // Today's total before this session (a session that crossed midnight only added part of itself today).
  const before = Math.max(0, summary.today_seconds - focused);
  const extended = before < summary.streak_min_seconds && summary.today_seconds >= summary.streak_min_seconds;
  const dailyGoal = summary.daily_goal_minutes * 60;

  return {
    summary,
    streak: summary.current_streak,
    extended,
    bestYet: extended && summary.current_streak >= 2 && summary.current_streak === summary.best_streak,
    dailyGoalHit: before < dailyGoal && summary.today_seconds >= dailyGoal,
    sessionGoalHit: !!session.goal_minutes && focused >= session.goal_minutes * 60,
  };
}
