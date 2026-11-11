import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { computeTimer } from '@/features/timer/engine';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Database, Session, SessionPause, Subject } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type Fns = Database['public']['Functions'];
type SessionFn = 'start_session' | 'pause_session' | 'resume_session' | 'end_session';

export type SessionWithSubject = Session & { subject: Pick<Subject, 'id' | 'name' | 'color'> | null };

export type StartOptions = {
  subject: Pick<Subject, 'id' | 'name' | 'color'> | null;
  goalMinutes: number | null;
  focusMinutes: number | null;
  breakMinutes: number | null;
  isPrivate: boolean;
};

type ActiveSessionState = {
  /** The signed-in user's running session, if any (on any device). */
  session: SessionWithSubject | null;
  pauses: SessionPause[];
  isLoading: boolean;
  /** Server clock minus this device's clock, in ms. Add it to Date.now() for server time. */
  offsetMs: number;
  busy: boolean;
  error: string | null;
  /** The last session this device saw finish, for the summary screen. */
  lastEnded: SessionWithSubject | null;
  /** Goes up whenever a session ends or is discarded; stats screens refetch when it changes. */
  statsVersion: number;
  start: (options: StartOptions) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  end: () => Promise<void>;
  discard: () => Promise<void>;
  dismissEnded: () => void;
  clearError: () => void;
};

const HEARTBEAT_MS = 60_000;
const AUTO_RETRY_MS = 5_000;
const SESSION_COLUMNS = '*, subject:subjects(id, name, color)';

const ActiveSessionContext = createContext<ActiveSessionState | null>(null);

/** Reads the user's running session (if any) and its pauses. */
async function fetchRunning(
  userId: string
): Promise<{ session: SessionWithSubject | null; pauses: SessionPause[] } | { error: Error }> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle();
  if (error) return { error };
  const session = (data as SessionWithSubject | null) ?? null;
  if (!session) return { session: null, pauses: [] };
  const { data: pauseRows } = await supabase
    .from('session_pauses')
    .select('*')
    .eq('session_id', session.id)
    .order('started_at');
  return { session, pauses: (pauseRows as SessionPause[] | null) ?? [] };
}

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const { session: auth } = useAuth();
  const userId = auth?.user.id ?? null;

  const [session, setSession] = useState<SessionWithSubject | null>(null);
  const [pauses, setPauses] = useState<SessionPause[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEnded, setLastEnded] = useState<SessionWithSubject | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const [wakeAt, setWakeAt] = useState(0);

  /** The running session as last seen, for callbacks that must not wait for a re-render. */
  const current = useRef<SessionWithSubject | null>(null);
  const autoActionInFlight = useRef(false);
  const retryAfter = useRef(0);

  /** Records the server time from a response, compensating for half the round trip. */
  const syncClock = useCallback((serverIso: string | null | undefined, sentAt: number) => {
    if (!serverIso) return;
    const receivedAt = Date.now();
    setOffsetMs(Date.parse(serverIso) - (sentAt + receivedAt) / 2);
  }, []);

  /** Applies a fresh read from the server; notices when the session we knew about has ended. */
  const apply = useCallback(
    async (forUser: string, result: Awaited<ReturnType<typeof fetchRunning>>) => {
      if ('error' in result) {
        setError(friendlyError(result.error));
        return;
      }
      // If the session we were showing is gone, it ended (here, on another device, or went stale).
      // Fetch it first so the summary is ready in the same update that clears the running session.
      const previousId = current.current?.id;
      const ended = previousId && previousId !== result.session?.id ? await fetchEnded(previousId) : null;
      current.current = result.session;
      setSession(result.session);
      setPauses(result.pauses);
      setLoadedFor(forUser);
      if (ended) {
        setLastEnded(ended);
        setStatsVersion((v) => v + 1);
      }
    },
    []
  );

  /** Re-reads the running session and its pauses from the server. */
  const load = useCallback(async () => {
    if (!userId) return;
    await apply(userId, await fetchRunning(userId));
  }, [userId, apply]);

  const heartbeat = useCallback(async () => {
    const id = current.current?.id;
    if (!id) return;
    const sentAt = Date.now();
    const { data, error: beatError } = await supabase.rpc('heartbeat_session', { p_session_id: id });
    if (beatError) return; // Offline: try again next beat.
    if (data) syncClock(data as string, sentAt);
    else await load(); // The session ended (elsewhere, or after going stale).
  }, [load, syncClock]);

  // Initial load, and live updates when this user's sessions change on any device.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchRunning(userId).then(async (result) => {
      if (cancelled) return;
      await apply(userId, result);
      heartbeat();
    });
    const channel = supabase
      .channel(`sessions:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${userId}` }, () => {
        load();
      })
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') load().then(heartbeat);
    });
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      appState.remove();
    };
  }, [userId, apply, load, heartbeat]);

  // Heartbeat while a session is running.
  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(heartbeat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [sessionId, heartbeat]);

  /** Runs a session function, applies the returned row, then refreshes pauses. */
  const act = useCallback(
    async <F extends SessionFn>(fn: F, args: Fns[F]['Args'], serverTime: (row: Session) => string | null) => {
      setBusy(true);
      setError(null);
      const sentAt = Date.now();
      try {
        const { data, error: rpcError } = await supabase.rpc(fn, args);
        if (rpcError) throw rpcError;
        // All four functions return the session row; the generic is too wide for TS to narrow.
        const row = data as unknown as Session;
        syncClock(serverTime(row), sentAt);
        const subject = current.current?.subject ?? null;
        if (row.ended_at) {
          current.current = null;
          setLastEnded({ ...row, subject });
          setStatsVersion((v) => v + 1);
          setSession(null);
          setPauses([]);
        } else {
          current.current = { ...row, subject };
          setSession(current.current);
        }
        await load();
        return true;
      } catch (e) {
        setError(friendlyError(e as Error));
        await load();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load, syncClock]
  );

  const start = useCallback(
    async (options: StartOptions) => {
      setLastEnded(null);
      const ok = await act(
        'start_session',
        {
          p_subject_id: options.subject?.id,
          p_goal_minutes: options.goalMinutes ?? undefined,
          p_pomodoro_focus_minutes: options.focusMinutes ?? undefined,
          p_pomodoro_break_minutes: options.breakMinutes ?? undefined,
          p_is_private: options.isPrivate,
        },
        (row) => row.last_heartbeat_at
      );
      return ok;
    },
    [act]
  );

  const pause = useCallback(async () => {
    if (session) await act('pause_session', { p_session_id: session.id, p_kind: 'pause' }, (r) => r.last_heartbeat_at);
  }, [act, session]);

  const resume = useCallback(async () => {
    if (session) await act('resume_session', { p_session_id: session.id }, (r) => r.last_heartbeat_at);
  }, [act, session]);

  const end = useCallback(async () => {
    if (session) await act('end_session', { p_session_id: session.id }, (r) => r.ended_at);
  }, [act, session]);

  const discard = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    const { error: deleteError } = await supabase.from('sessions').delete().eq('id', session.id);
    if (deleteError) setError(friendlyError(deleteError));
    else setStatsVersion((v) => v + 1);
    current.current = null;
    setSession(null);
    setPauses([]);
    setBusy(false);
    await load();
  }, [load, session]);

  // Automatic steps: start a Pomodoro break, end it, or finish when the goal is reached.
  // Schedules a wake-up for the next step instead of ticking every second.
  useEffect(() => {
    if (!session) return;
    const state = computeTimer(session, pauses, Date.now() + offsetMs);

    let delayMs: number;
    if (state.due !== 'none') {
      // Act now, or after a short wait if the last attempt failed (e.g. offline), never in a tight loop.
      delayMs = Math.max(0, retryAfter.current - Date.now());
    } else if (state.phaseRemaining !== null && state.phase !== 'paused') {
      // Focus rounds and breaks wake up when their time is up; paused sessions wait for the user.
      delayMs = state.phaseRemaining * 1000 + 250;
    } else {
      return;
    }

    const timer = setTimeout(() => {
      const current = computeTimer(session, pauses, Date.now() + offsetMs);
      if (current.due === 'none') {
        setWakeAt(Date.now());
        return;
      }
      if (autoActionInFlight.current) return;
      autoActionInFlight.current = true;
      const run =
        current.due === 'startBreak'
          ? act('pause_session', { p_session_id: session.id, p_kind: 'break' }, (r) => r.last_heartbeat_at)
          : current.due === 'endBreak'
            ? act('resume_session', { p_session_id: session.id }, (r) => r.last_heartbeat_at)
            : act('end_session', { p_session_id: session.id }, (r) => r.ended_at);
      run.then((ok) => {
        autoActionInFlight.current = false;
        if (!ok) {
          retryAfter.current = Date.now() + AUTO_RETRY_MS;
          setWakeAt(Date.now());
        }
      });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [session, pauses, offsetMs, act, wakeAt]);

  const value = useMemo<ActiveSessionState>(
    () => ({
      session,
      pauses,
      isLoading: !!userId && loadedFor !== userId,
      offsetMs,
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
    [session, pauses, userId, loadedFor, offsetMs, busy, error, lastEnded, statsVersion, start, pause, resume, end, discard]
  );

  return <ActiveSessionContext.Provider value={value}>{children}</ActiveSessionContext.Provider>;
}

export function useActiveSession() {
  const value = useContext(ActiveSessionContext);
  if (!value) throw new Error('useActiveSession must be used inside <ActiveSessionProvider>.');
  return value;
}

async function fetchEnded(sessionId: string) {
  const { data } = await supabase.from('sessions').select(SESSION_COLUMNS).eq('id', sessionId).maybeSingle();
  return data?.ended_at ? (data as SessionWithSubject) : null;
}
