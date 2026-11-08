// Pure timer math. Everything is derived from the session row and its pauses (the server's record),
// evaluated at a given server-clock time, so every device shows the same thing.

import type { Session, SessionPause } from '@/lib/types';

export type TimerPhase = 'focus' | 'break' | 'paused' | 'ended';

/** What the app should do right now to keep the session in line with its plan. */
export type TimerDue = 'none' | 'startBreak' | 'endBreak' | 'complete';

export type TimerState = {
  phase: TimerPhase;
  focusedSeconds: number;
  pausedSeconds: number;
  goalSeconds: number | null;
  /** Seconds left in the current focus round or break (frozen while paused); null when open-ended. */
  phaseRemaining: number | null;
  /** Pomodoro round (1-based); null without Pomodoro. */
  round: number | null;
  totalRounds: number | null;
  due: TimerDue;
  /** Server-clock ms when the session should finish; null when open-ended or paused. */
  estimatedEndMs: number | null;
};

type SessionTiming = Pick<
  Session,
  | 'started_at'
  | 'ended_at'
  | 'paused_at'
  | 'paused_seconds'
  | 'goal_minutes'
  | 'pomodoro_focus_minutes'
  | 'pomodoro_break_minutes'
>;
type PauseTiming = Pick<SessionPause, 'kind' | 'started_at' | 'ended_at'>;

export function computeTimer(session: SessionTiming, pauses: PauseTiming[], nowMs: number): TimerState {
  const startMs = Date.parse(session.started_at);
  const endMs = session.ended_at ? Date.parse(session.ended_at) : null;
  const at = Math.max(startMs, endMs ?? nowMs);

  // Totals come from the session row (exact, kept by the server). The pause list only tells us how many
  // breaks were taken and whether the current pause is a break; it can briefly lag behind the row.
  const open =
    !endMs && session.paused_at
      ? { kind: pauses.find((p) => !p.ended_at)?.kind ?? 'pause', started_at: session.paused_at }
      : null;
  const pausedMs =
    session.paused_seconds * 1000 + (open ? Math.max(0, at - Date.parse(open.started_at)) : 0);
  const breaksTaken = pauses.filter((p) => p.kind === 'break').length;

  const focusedSeconds = Math.max(0, Math.floor((at - startMs - pausedMs) / 1000));
  const pausedSeconds = Math.floor(pausedMs / 1000);
  const goalSeconds = session.goal_minutes ? session.goal_minutes * 60 : null;
  const focusLen = session.pomodoro_focus_minutes ? session.pomodoro_focus_minutes * 60 : null;
  const breakLen = session.pomodoro_break_minutes ? session.pomodoro_break_minutes * 60 : null;
  const totalRounds = focusLen && goalSeconds ? Math.ceil(goalSeconds / focusLen) : null;

  const base = { focusedSeconds, pausedSeconds, goalSeconds, totalRounds };

  if (endMs) {
    return { ...base, phase: 'ended', phaseRemaining: null, round: null, due: 'none', estimatedEndMs: null };
  }

  // Focus left in the current round (or until the goal), whether or not we are focusing right now.
  const nextBreakAt = focusLen ? (breaksTaken + 1) * focusLen : Infinity;
  const focusEnd = Math.min(nextBreakAt, goalSeconds ?? Infinity);
  const focusRemaining = Number.isFinite(focusEnd) ? Math.max(0, focusEnd - focusedSeconds) : null;

  if (open) {
    const isBreak = open.kind === 'break';
    const breakElapsed = (at - Date.parse(open.started_at)) / 1000;
    const phaseRemaining = isBreak
      ? breakLen
        ? Math.max(0, Math.ceil(breakLen - breakElapsed))
        : null
      : focusRemaining;
    const breaksLeft = totalRounds ? Math.max(0, totalRounds - 1 - breaksTaken) : 0;
    const estimatedEndMs =
      isBreak && goalSeconds && breakLen && phaseRemaining !== null
        ? at + (goalSeconds - focusedSeconds + phaseRemaining + breaksLeft * breakLen) * 1000
        : null;
    return {
      ...base,
      phase: isBreak ? 'break' : 'paused',
      phaseRemaining,
      round: focusLen ? (isBreak ? breaksTaken : breaksTaken + 1) : null,
      due: isBreak && phaseRemaining === 0 ? 'endBreak' : 'none',
      estimatedEndMs,
    };
  }

  // Focusing.
  const phaseRemaining = focusRemaining;

  let due: TimerDue = 'none';
  if (goalSeconds && focusedSeconds >= goalSeconds) due = 'complete';
  else if (focusLen && focusedSeconds >= nextBreakAt) due = 'startBreak';

  let estimatedEndMs: number | null = null;
  if (goalSeconds) {
    const breaksLeft = totalRounds && breakLen ? Math.max(0, totalRounds - 1 - breaksTaken) * breakLen : 0;
    estimatedEndMs = at + (Math.max(0, goalSeconds - focusedSeconds) + breaksLeft) * 1000;
  }

  return {
    ...base,
    phase: 'focus',
    phaseRemaining,
    round: focusLen ? breaksTaken + 1 : null,
    due,
    estimatedEndMs,
  };
}

/** Plan shown on the setup card before starting. */
export function planSession(goalMinutes: number | null, focusMinutes: number | null, breakMinutes: number | null) {
  if (!goalMinutes) return { rounds: null, breakMinutes: 0, totalMinutes: null };
  if (!focusMinutes || !breakMinutes) return { rounds: null, breakMinutes: 0, totalMinutes: goalMinutes };
  const rounds = Math.ceil(goalMinutes / focusMinutes);
  const totalBreak = Math.max(0, rounds - 1) * breakMinutes;
  return { rounds, breakMinutes: totalBreak, totalMinutes: goalMinutes + totalBreak };
}
