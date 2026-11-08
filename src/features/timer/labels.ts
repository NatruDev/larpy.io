import { APP_NAME } from '@/constants/brand';
import { formatClock } from '@/lib/format';

import type { TimerState } from './engine';

/** The big number: time left in this round/break, or time focused when there's no limit. */
export function clockSeconds(state: TimerState) {
  return state.phaseRemaining ?? state.focusedSeconds;
}

/** Short status under the subject, e.g. "Round 2 of 4", "Break", "Paused". */
export function phaseLabel(state: TimerState) {
  if (state.phase === 'break') return 'Break';
  if (state.phase === 'paused') return 'Paused';
  if (state.phase === 'ended') return 'Finished';
  if (state.round && state.totalRounds) return `Round ${state.round} of ${state.totalRounds}`;
  if (state.round) return `Round ${state.round}`;
  return state.goalSeconds ? 'Focusing' : 'Focusing, no time limit';
}

/** Browser tab title while a session runs, e.g. "18:42 Chemistry | Larpy". */
export function sessionTitle(state: TimerState, subjectName: string | null | undefined) {
  const clock = formatClock(clockSeconds(state));
  const what = state.phase === 'break' ? 'Break' : state.phase === 'paused' ? 'Paused' : subjectName || 'Focus';
  return `${clock} ${what} | ${APP_NAME}`;
}
