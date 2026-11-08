import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  localDailyTotals,
  localReady,
  localRecentSessions,
  localSubjectTotals,
  localSummary,
} from '@/features/local/local-store';
import { LOCAL_MODE } from '@/lib/backend';
import { supabase } from '@/lib/supabase';
import type { Session, Subject } from '@/lib/types';
import { useActiveSession } from '@/providers/active-session-provider';
import { useAuth } from '@/providers/auth-provider';

import { addDays, startOfMonth, startOfWeek } from './dates';

export type StatsSummary = {
  /** The user's local date, 'YYYY-MM-DD' */
  today: string;
  time_zone: string;
  daily_goal_minutes: number;
  streak_min_seconds: number;
  current_streak: number;
  best_streak: number;
  today_seconds: number;
  week: { day: string; seconds: number }[];
  total_seconds: number;
  active_days: number;
};

export type SubjectTotal = { subject_id: string | null; name: string | null; color: string | null; seconds: number };

export type RecentSession = Session & { subject: Pick<Subject, 'id' | 'name' | 'color'> | null };

export type SubjectRange = 'week' | 'month' | 'all';

/**
 * Loads data for the signed-in user and reloads it whenever a session finishes (on any device) or the
 * app comes back to the foreground. `key` lets callers reload on their own inputs too.
 */
export function useLiveQuery<T>(load: (userId: string) => Promise<T>, key: string) {
  const { session } = useAuth();
  const { statsVersion } = useActiveSession();
  const userId = session?.user.id;
  const [state, setState] = useState<{ token: string; data: T } | null>(null);
  const [focusCount, setFocusCount] = useState(0);
  const token = `${userId}|${key}|${statsVersion}|${focusCount}`;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setFocusCount((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    load(userId)
      .then((data) => {
        if (!cancelled) setState({ token, data });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // `load` is recreated each render; `token` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep showing the previous data while a refresh is in flight.
  return { data: state?.data ?? null, isLoading: state?.token !== token };
}

export function useStatsSummary() {
  return useLiveQuery(async () => {
    if (LOCAL_MODE) {
      await localReady();
      return localSummary();
    }
    const { data, error } = await supabase.rpc('get_my_summary');
    if (error) throw error;
    return data as StatsSummary;
  }, 'summary');
}

/** Focused seconds per local day from `from` (inclusive), as a map of 'YYYY-MM-DD' to seconds. */
export function useDailyTotals(from: string | null) {
  return useLiveQuery(async (userId) => {
    if (!from) return new Map<string, number>();
    if (LOCAL_MODE) {
      await localReady();
      return new Map([...localDailyTotals()].filter(([day]) => day >= from));
    }
    const { data, error } = await supabase
      .from('daily_stats')
      .select('day, focused_seconds')
      .eq('user_id', userId)
      .gte('day', from)
      .order('day');
    if (error) throw error;
    return new Map((data ?? []).map((r: { day: string; focused_seconds: number }) => [r.day, r.focused_seconds]));
  }, `daily:${from}`);
}

export function rangeStart(range: SubjectRange, today: string) {
  if (range === 'week') return startOfWeek(today);
  if (range === 'month') return startOfMonth(today);
  return null;
}

export function useSubjectTotals(range: SubjectRange, today: string | null) {
  return useLiveQuery(async () => {
    if (!today) return [] as SubjectTotal[];
    if (LOCAL_MODE) {
      await localReady();
      return localSubjectTotals(rangeStart(range, today), range === 'all' ? null : today);
    }
    const { data, error } = await supabase.rpc('get_subject_totals', {
      p_from: rangeStart(range, today) ?? undefined,
      p_to: range === 'all' ? undefined : today,
    });
    if (error) throw error;
    return (data ?? []).map((r: { subject_id: string | null; name: string | null; color: string | null; focused_seconds: number }) => ({
      subject_id: r.subject_id,
      name: r.name,
      color: r.color,
      seconds: Number(r.focused_seconds),
    })) as SubjectTotal[];
  }, `subjects:${range}:${today}`);
}

export function useRecentSessions(limit = 8) {
  return useLiveQuery(async (userId) => {
    if (LOCAL_MODE) {
      await localReady();
      return localRecentSessions(limit);
    }
    const { data, error } = await supabase
      .from('sessions')
      .select('*, subject:subjects(id, name, color)')
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RecentSession[];
  }, `recent:${limit}`);
}

/** First day shown by the year heatmap: the Monday 52 weeks before this week's Monday. */
export function heatmapStart(today: string) {
  return addDays(startOfWeek(today), -52 * 7);
}
