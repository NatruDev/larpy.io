import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  discardLocalSession,
  endLocalSession,
  endStaleLocalSessions,
  getRunningLocalSession,
  heartbeatLocalSession,
  localReady,
  pauseLocalSession,
  resumeLocalSession,
  startLocalSession,
  type LocalSession,
} from '@/features/local/local-store';
import { computeTimer } from '@/features/timer/engine';
import { friendlyError } from '@/lib/errors';
import type { SessionPause } from '@/lib/types';

import { ActiveSessionContext, type ActiveSessionState, type SessionWithSubject, type StartOptions } from './active-session-context';

const HEARTBEAT_MS = 60_000;

/**
 * The running session in local mode: the same behaviour as the Supabase provider (Pomodoro breaks start
 * and end on their own, the session finishes at its goal, it survives a refresh), using this device's
 * clock and storage instead of the server.
 */
export function LocalActiveSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionWithSubject | null>(null);
  const [pauses, setPauses] = useState<SessionPause[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEnded, setLastEnded] = useState<SessionWithSubject | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const [wakeAt, setWakeAt] = useState(0);
  const current = useRef<SessionWithSubject | null>(null);

  const reload = useCallback(() => {
    const running = getRunningLocalSession();
    current.current = running.session;
    setSession(running.session);
    setPauses(running.pauses);
  }, []);

  // Load what's saved, and end a session left running in a tab that was closed for a while.
  useEffect(() => {
    localReady().then(() => {
      endStaleLocalSessions();
      reload();
      setLoaded(true);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const before = current.current;
      endStaleLocalSessions();
      reload();
      if (before && !current.current) setStatsVersion((v) => v + 1);
    });
    return () => appState.remove();
  }, [reload]);

  // Heartbeat while a session runs, so a closed tab doesn't count as hours of focus.
  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId) return;
    heartbeatLocalSession(sessionId);
    const timer = setInterval(() => heartbeatLocalSession(sessionId), HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [sessionId]);

  /** Runs one session step, then shows the result (and the summary if it ended). */
  const act = useCallback(
    async (step: () => LocalSession) => {
      setBusy(true);
      setError(null);
      try {
        const row = step();
        if (row.ended_at) {
          setLastEnded(row);
          setStatsVersion((v) => v + 1);
        }
        reload();
        return true;
      } catch (e) {
        setError(friendlyError(e as Error));
        reload();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  const start = useCallback(
    async (options: StartOptions) => {
      setLastEnded(null);
      return act(() =>
        startLocalSession({
          subjectId: options.subject?.id ?? null,
          goalMinutes: options.goalMinutes,
          focusMinutes: options.focusMinutes,
          breakMinutes: options.breakMinutes,
          isPrivate: options.isPrivate,
        })
      );
    },
    [act]
  );

  const pause = useCallback(async () => {
    if (session) await act(() => pauseLocalSession(session.id, 'pause'));
  }, [act, session]);

  const resume = useCallback(async () => {
    if (session) await act(() => resumeLocalSession(session.id));
  }, [act, session]);

  const end = useCallback(async () => {
    if (session) await act(() => endLocalSession(session.id));
  }, [act, session]);

  const discard = useCallback(async () => {
    if (!session) return;
    discardLocalSession(session.id);
    setStatsVersion((v) => v + 1);
    reload();
  }, [reload, session]);

  // Automatic steps: start a Pomodoro break, end it, or finish when the goal is reached.
  useEffect(() => {
    if (!session) return;
    const state = computeTimer(session, pauses, Date.now());
    let delayMs: number;
    if (state.due !== 'none') delayMs = 0;
    else if (state.phaseRemaining !== null && state.phase !== 'paused') delayMs = state.phaseRemaining * 1000 + 250;
    else return;

    const timer = setTimeout(() => {
      const due = computeTimer(session, pauses, Date.now()).due;
      if (due === 'none') setWakeAt(Date.now());
      else if (due === 'startBreak') act(() => pauseLocalSession(session.id, 'break'));
      else if (due === 'endBreak') act(() => resumeLocalSession(session.id));
      else act(() => endLocalSession(session.id));
    }, delayMs);
    return () => clearTimeout(timer);
  }, [session, pauses, act, wakeAt]);

  const value = useMemo<ActiveSessionState>(
    () => ({
      session,
      pauses,
      isLoading: !loaded,
      offsetMs: 0,
      busy,
      error,
      lastEnded,
      statsVersion,
      start,
      pause,
      resume,
      end,
      discard,
      dismissEnded: () => setLastEnded(null),
      clearError: () => setError(null),
    }),
    [session, pauses, loaded, busy, error, lastEnded, statsVersion, start, pause, resume, end, discard]
  );

  return <ActiveSessionContext.Provider value={value}>{children}</ActiveSessionContext.Provider>;
}
