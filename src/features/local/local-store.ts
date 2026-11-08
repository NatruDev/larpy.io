// On-device stand-in for the database, used in local mode (see src/lib/backend.ts).
//
// It keeps the same rows the server would (profile, subjects, sessions, session pauses) and follows the
// same rules as the session functions and stats in supabase/migrations: one running session at a time,
// pauses and breaks closed when resuming or ending, focused time = elapsed − paused, a session with no
// heartbeat for 15 minutes ends at its last heartbeat, a day counts toward the streak with 60 seconds of
// focus. Days are this device's local days. Everything is one JSON blob in AsyncStorage (localStorage on
// the web), so it lasts until the browser's site data is cleared.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { addDays, startOfWeek } from '@/features/stats/dates';
import type { Profile, Session, SessionPause, Subject } from '@/lib/types';

import type { RecentSession, StatsSummary, SubjectTotal } from '@/features/stats/use-stats';

export const LOCAL_USER_ID = 'local-user';

const STORAGE_KEY = 'larpy.local.v1';
const STREAK_MIN_SECONDS = 60;
const STALE_AFTER_MS = 15 * 60_000;

type LocalData = {
  version: 1;
  profile: Profile | null;
  subjects: Subject[];
  sessions: Session[];
  pauses: SessionPause[];
};

type SubjectRef = Pick<Subject, 'id' | 'name' | 'color'>;
export type LocalSession = Session & { subject: SubjectRef | null };

const empty = (): LocalData => ({ version: 1, profile: null, subjects: [], sessions: [], pauses: [] });

let data: LocalData = empty();
let loading: Promise<void> | null = null;

/** Loads the saved data once; every read below waits for this first. */
export function localReady() {
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) data = { ...empty(), ...(JSON.parse(raw) as Partial<LocalData>), version: 1 };
      })
      .catch(() => {});
  }
  return loading;
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
}

function uuid() {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const nowIso = () => new Date().toISOString();
const pad = (n: number) => String(n).padStart(2, '0');

/** This device's local day for an instant, 'YYYY-MM-DD'. */
export function localDayOf(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local midnight at the start of a 'YYYY-MM-DD' day, in ms. */
const midnight = (day: string) => new Date(`${day}T00:00:00`).getTime();

function subjectRef(id: string | null): SubjectRef | null {
  const s = id ? data.subjects.find((x) => x.id === id) : null;
  return s ? { id: s.id, name: s.name, color: s.color } : null;
}
const withSubject = (s: Session): LocalSession => ({ ...s, subject: subjectRef(s.subject_id) });

function findSession(id: string) {
  const s = data.sessions.find((x) => x.id === id);
  if (!s) throw new Error('That session was not found.');
  return s;
}

/** Ends an open pause at `atMs`, adding its length to the session's paused total. */
function closeOpenPause(s: Session, atMs: number) {
  if (!s.paused_at) return;
  const pausedFrom = Date.parse(s.paused_at);
  const end = Math.max(pausedFrom, atMs);
  s.paused_seconds += Math.max(0, Math.floor((end - pausedFrom) / 1000));
  s.paused_at = null;
  for (const p of data.pauses) if (p.session_id === s.id && !p.ended_at) p.ended_at = new Date(end).toISOString();
}

function finish(s: Session, atMs: number) {
  closeOpenPause(s, atMs);
  const end = Math.max(Date.parse(s.started_at), atMs);
  s.ended_at = new Date(end).toISOString();
  s.focused_seconds = Math.max(0, Math.floor((end - Date.parse(s.started_at)) / 1000) - s.paused_seconds);
}

// ---------------------------------------------------------------------------------------------
// Profile and subjects
// ---------------------------------------------------------------------------------------------

export function getLocalProfile() {
  return data.profile;
}

export function getLocalSubjects() {
  return data.subjects.filter((s) => !s.archived_at);
}

export function completeLocalOnboarding(input: {
  displayName: string | null;
  username: string;
  dailyGoalMinutes: number;
  timeZone: string;
  subjects: { name: string; color: string }[];
}) {
  const created = nowIso();
  data.profile = {
    id: LOCAL_USER_ID,
    username: input.username,
    display_name: input.displayName,
    daily_goal_minutes: input.dailyGoalMinutes,
    time_zone: input.timeZone,
    onboarded_at: created,
    avatar_url: null,
    bio: null,
    is_private: false,
    created_at: data.profile?.created_at ?? created,
  };
  const existing = new Set(data.subjects.map((s) => s.name.toLowerCase()));
  for (const s of input.subjects) {
    if (existing.has(s.name.toLowerCase())) continue;
    data.subjects.push({ id: uuid(), user_id: LOCAL_USER_ID, name: s.name, color: s.color, created_at: nowIso(), archived_at: null });
  }
  persist();
}

/** Deletes everything kept on this device. */
export async function clearLocalData() {
  data = empty();
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

// ---------------------------------------------------------------------------------------------
// Sessions (mirror start_session / pause_session / resume_session / end_session)
// ---------------------------------------------------------------------------------------------

/** Ends sessions that stopped sending heartbeats (the tab was closed), at their last heartbeat. */
export function endStaleLocalSessions() {
  let changed = false;
  for (const s of data.sessions) {
    if (s.ended_at || s.source !== 'timer' || !s.last_heartbeat_at) continue;
    const last = Date.parse(s.last_heartbeat_at);
    if (Date.now() - last > STALE_AFTER_MS) {
      finish(s, last);
      changed = true;
    }
  }
  if (changed) persist();
}

export function getRunningLocalSession(): { session: LocalSession | null; pauses: SessionPause[] } {
  const s = data.sessions.find((x) => !x.ended_at);
  if (!s) return { session: null, pauses: [] };
  return { session: withSubject(s), pauses: data.pauses.filter((p) => p.session_id === s.id) };
}

export function getLocalPauses(sessionId: string) {
  return data.pauses.filter((p) => p.session_id === sessionId).sort((a, b) => a.started_at.localeCompare(b.started_at));
}

export function startLocalSession(input: {
  subjectId: string | null;
  goalMinutes: number | null;
  focusMinutes: number | null;
  breakMinutes: number | null;
  isPrivate: boolean;
}): LocalSession {
  endStaleLocalSessions();
  if (data.sessions.some((s) => !s.ended_at)) throw new Error('You already have a session running.');
  const at = nowIso();
  const s: Session = {
    id: uuid(),
    user_id: LOCAL_USER_ID,
    subject_id: input.subjectId,
    started_at: at,
    ended_at: null,
    paused_at: null,
    paused_seconds: 0,
    focused_seconds: null,
    goal_minutes: input.goalMinutes,
    pomodoro_focus_minutes: input.focusMinutes,
    pomodoro_break_minutes: input.breakMinutes,
    is_private: input.isPrivate,
    source: 'timer',
    caption: null,
    created_at: at,
    time_zone: data.profile?.time_zone ?? 'UTC',
    last_heartbeat_at: at,
  };
  data.sessions.push(s);
  persist();
  return withSubject(s);
}

export function pauseLocalSession(id: string, kind: SessionPause['kind']): LocalSession {
  const s = findSession(id);
  if (!s.ended_at && !s.paused_at) {
    const at = nowIso();
    s.paused_at = at;
    s.last_heartbeat_at = at;
    data.pauses.push({ id: uuid(), session_id: s.id, kind, started_at: at, ended_at: null });
    persist();
  }
  return withSubject(s);
}

export function resumeLocalSession(id: string): LocalSession {
  const s = findSession(id);
  if (!s.ended_at && s.paused_at) {
    closeOpenPause(s, Date.now());
    s.last_heartbeat_at = nowIso();
    persist();
  }
  return withSubject(s);
}

export function endLocalSession(id: string): LocalSession {
  const s = findSession(id);
  if (!s.ended_at) {
    finish(s, Date.now());
    persist();
  }
  return withSubject(s);
}

/** Records that the session is still being timed. Returns false once it has ended. */
export function heartbeatLocalSession(id: string) {
  const s = data.sessions.find((x) => x.id === id);
  if (!s || s.ended_at) return false;
  s.last_heartbeat_at = nowIso();
  persist();
  return true;
}

export function discardLocalSession(id: string) {
  data.sessions = data.sessions.filter((s) => s.id !== id);
  data.pauses = data.pauses.filter((p) => p.session_id !== id);
  persist();
}

export function setLocalCaption(id: string, caption: string | null) {
  findSession(id).caption = caption;
  persist();
}

// ---------------------------------------------------------------------------------------------
// Stats (mirror session_day_parts, get_my_summary and get_subject_totals)
// ---------------------------------------------------------------------------------------------

/** A finished session's focused seconds per local day (sessions across midnight are split). */
function dayParts(s: Session): { day: string; seconds: number }[] {
  const start = Date.parse(s.started_at);
  const end = Date.parse(s.ended_at!);
  const first = localDayOf(start);
  const last = localDayOf(end);
  if (first === last) return [{ day: first, seconds: s.focused_seconds ?? 0 }];
  const pauses = data.pauses.filter((p) => p.session_id === s.id);
  const parts: { day: string; seconds: number }[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    const winStart = Math.max(start, midnight(day));
    const winEnd = Math.min(end, midnight(addDays(day, 1)));
    const pausedMs = pauses.reduce((sum, p) => {
      const pStart = Date.parse(p.started_at);
      const pEnd = p.ended_at ? Date.parse(p.ended_at) : end;
      return sum + Math.max(0, Math.min(pEnd, winEnd) - Math.max(pStart, winStart));
    }, 0);
    parts.push({ day, seconds: Math.max(0, Math.floor((winEnd - winStart) / 1000) - Math.floor(pausedMs / 1000)) });
  }
  return parts;
}

const finished = () => data.sessions.filter((s) => s.ended_at);

/** Focused seconds per local day, for every day with any focus. */
export function localDailyTotals() {
  const totals = new Map<string, number>();
  for (const s of finished()) for (const p of dayParts(s)) totals.set(p.day, (totals.get(p.day) ?? 0) + p.seconds);
  return totals;
}

export function localSummary(): StatsSummary {
  const totals = localDailyTotals();
  const today = localDayOf(Date.now());
  const monday = startOfWeek(today);

  // Streaks: runs of consecutive days with enough focus. The current run must reach today or yesterday.
  const days = [...totals.entries()].filter(([, sec]) => sec >= STREAK_MIN_SECONDS).map(([d]) => d).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const current = prev && prev >= addDays(today, -1) ? run : 0;

  return {
    today,
    time_zone: data.profile?.time_zone ?? 'UTC',
    daily_goal_minutes: data.profile?.daily_goal_minutes ?? 60,
    streak_min_seconds: STREAK_MIN_SECONDS,
    current_streak: current,
    best_streak: best,
    today_seconds: totals.get(today) ?? 0,
    week: Array.from({ length: 7 }, (_, i) => {
      const day = addDays(monday, i);
      return { day, seconds: totals.get(day) ?? 0 };
    }),
    total_seconds: [...totals.values()].reduce((a, b) => a + b, 0),
    active_days: days.length,
  };
}

/** Focused time per subject between two local days (inclusive; null = no limit), largest first. */
export function localSubjectTotals(from: string | null, to: string | null): SubjectTotal[] {
  const bySubject = new Map<string | null, number>();
  for (const s of finished()) {
    for (const p of dayParts(s)) {
      if ((from && p.day < from) || (to && p.day > to)) continue;
      bySubject.set(s.subject_id, (bySubject.get(s.subject_id) ?? 0) + p.seconds);
    }
  }
  return [...bySubject.entries()]
    .filter(([, sec]) => sec > 0)
    .map(([id, seconds]) => {
      const ref = subjectRef(id);
      return { subject_id: id, name: ref?.name ?? null, color: ref?.color ?? null, seconds };
    })
    .sort((a, b) => b.seconds - a.seconds);
}

export function localRecentSessions(limit: number): RecentSession[] {
  return finished()
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit)
    .map(withSubject);
}

/** Finished sessions that started on or after `fromIso`, oldest first. */
export function localSessionsSince(fromIso: string): RecentSession[] {
  const from = Date.parse(fromIso);
  return finished()
    .filter((s) => Date.parse(s.started_at) >= from)
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map(withSubject);
}
