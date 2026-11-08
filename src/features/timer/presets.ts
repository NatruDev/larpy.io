export const DURATION_CHOICES = [25, 45, 60, 90, 120, 180] as const;

export type BreakPreset = { focus: number; rest: number; note?: string };

export const BREAK_PRESETS: readonly BreakPreset[] = [
  { focus: 25, rest: 5, note: 'Classic' },
  { focus: 50, rest: 10 },
  { focus: 52, rest: 17 },
  { focus: 90, rest: 20, note: 'Deep work' },
];

export const MIN_GOAL = 5;
export const MAX_GOAL = 12 * 60;
export const GOAL_STEP = 5;
