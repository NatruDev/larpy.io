import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { DurationDial } from '@/components/timer/duration-dial';
import { NewSubjectForm } from '@/components/timer/new-subject-form';
import { QuickLengths } from '@/components/timer/quick-lengths';
import { SubjectPicker } from '@/components/timer/subject-picker';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { planSession } from '@/features/timer/engine';
import { BREAK_PRESETS, DURATION_CHOICES, GOAL_STEP, MAX_GOAL, MIN_GOAL } from '@/features/timer/presets';
import { useSubjects } from '@/features/subjects/use-subjects';
import { formatGoal, formatGoalShort, formatTimeOfDay } from '@/lib/format';
import { useActiveSession } from '@/providers/active-session-provider';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { Radius, Spacing, subjectColor, useTheme } from '@/theme';

const SETUP_KEY = 'focus.setup';

/** Shortcuts under the dial; null = no limit. */
const QUICK_LENGTHS = [
  ...DURATION_CHOICES.map((m) => ({ value: m as number | null, label: m === 90 ? '90m' : formatGoalShort(m) })),
  { value: null, label: '∞' },
];

type Setup = {
  subjectId: string | null;
  /** null = no time limit (stopwatch) */
  goalMinutes: number | null;
  breaksOn: boolean;
  presetIndex: number;
  isPrivate: boolean;
};

const DEFAULT_SETUP: Setup = { subjectId: null, goalMinutes: 60, breaksOn: false, presetIndex: 0, isPrivate: false };

export default function FocusScreen() {
  const { session, start, busy, error, clearError } = useActiveSession();
  const { scheme, colors } = useTheme();
  const { subjects, addSubject } = useSubjects();
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [addingSubject, setAddingSubject] = useState(false);
  // The dial sweeps for its own changes (drag, taps, −/+) but jumps for presets and the restored setup,
  // where sweeping through many laps (12 h → 25 min) looks like a glitch.
  const [animateDial, setAnimateDial] = useState(false);
  const breakpoint = useBreakpoint();
  const { width: windowWidth } = useWindowDimensions();

  // Remember the last setup on this device.
  useEffect(() => {
    AsyncStorage.getItem(SETUP_KEY)
      .then((saved) => {
        if (saved) setSetup({ ...DEFAULT_SETUP, ...(JSON.parse(saved) as Partial<Setup>) });
      })
      .catch(() => {});
  }, []);

  function update(patch: Partial<Setup>) {
    clearError();
    setSetup((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(SETUP_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  if (session) {
    return (
      <Screen title="Focus">
        <Card>
          <Text variant="heading">You have a session running</Text>
          <Text color="textMuted">
            {session.subject ? `${session.subject.name}, started` : 'Started'} at{' '}
            {formatTimeOfDay(Date.parse(session.started_at))}. It keeps going while you look around.
          </Text>
          <Button label="Back to your session" icon="timer" onPress={() => router.push('/session')} />
        </Card>
      </Screen>
    );
  }

  const subject = subjects.find((s) => s.id === setup.subjectId) ?? null;
  const goal = setup.goalMinutes;
  const fits = (p: { focus: number }) => goal === null || goal > p.focus;
  // Use the saved preset if it fits this length, otherwise the first one that does.
  const presetIndex = fits(BREAK_PRESETS[setup.presetIndex] ?? BREAK_PRESETS[0])
    ? setup.presetIndex
    : Math.max(0, BREAK_PRESETS.findIndex(fits));
  const preset = BREAK_PRESETS[presetIndex] ?? BREAK_PRESETS[0];
  const breaksFit = BREAK_PRESETS.some(fits);
  const breaksActive = setup.breaksOn && breaksFit;
  const plan = planSession(goal, breaksActive ? preset.focus : null, breaksActive ? preset.rest : null);

  async function onStart() {
    const ok = await start({
      subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
      goalMinutes: goal,
      focusMinutes: breaksActive ? preset.focus : null,
      breakMinutes: breaksActive ? preset.rest : null,
      isPrivate: setup.isPrivate,
    });
    if (ok) router.push('/session');
  }

  // Fill a phone's width (minus screen padding), capped so it doesn't dominate wider layouts.
  const dialSize = breakpoint === 'phone' ? Math.min(320, windowWidth - 2 * (Spacing.lg + Spacing.xs)) : 320;
  const startLabel = [goal === null ? 'open-ended' : formatGoal(goal), subject?.name].filter(Boolean).join(' · ');
  const startBlock = (
    <View style={styles.footer}>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
      <Button label={busy ? 'Starting…' : `Start ${startLabel}`} icon="play" size="lg" onPress={onStart} disabled={busy} />
    </View>
  );
  // On phones Start is pinned above the tab bar so it's always in thumb reach; wider screens keep it inline.
  const pinStart = breakpoint === 'phone';

  return (
    <Screen title="Focus" footer={pinStart ? startBlock : undefined}>
      <View style={styles.dialBlock}>
        <DurationDial
          minutes={goal}
          onChange={(m) => {
            setAnimateDial(true);
            update({ goalMinutes: m });
          }}
          animated={animateDial}
          min={MIN_GOAL}
          max={MAX_GOAL}
          step={GOAL_STEP}
          color={subject ? subjectColor(subject.color, scheme, colors.accent) : colors.accent}
          caption={dialCaption(plan.totalMinutes)}
          size={dialSize}
        />
        <View style={{ width: dialSize }}>
          <QuickLengths
            options={QUICK_LENGTHS}
            value={goal}
            onChange={(m) => {
              setAnimateDial(false);
              update({ goalMinutes: m });
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          Subject
        </Text>
        <SubjectPicker
          subjects={subjects}
          selectedId={subject?.id ?? null}
          onSelect={(id) => update({ subjectId: id })}
          onAdd={() => setAddingSubject((open) => !open)}
          adding={addingSubject}
        />
        {addingSubject ? (
          <NewSubjectForm
            onCancel={() => setAddingSubject(false)}
            onAdd={async (name) => {
              const added = await addSubject(name);
              update({ subjectId: added.id });
              setAddingSubject(false);
            }}
          />
        ) : null}
      </View>

      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.groupRow}>
          <ToggleRow
            icon="timer"
            hue="orange"
            label="Pomodoro breaks"
            caption={pomodoroCaption(goal, plan, breaksActive ? preset : null, breaksFit)}
            value={breaksActive}
            onValueChange={(on) => update({ breaksOn: on })}
            disabled={!breaksFit}
          />
          {breaksActive ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.noGrow}
              contentContainerStyle={styles.breakPresets}>
              {BREAK_PRESETS.map((p, i) => (
                <Chip
                  key={`${p.focus}-${p.rest}`}
                  label={`${p.focus}/${p.rest}${p.note ? ` ${p.note}` : ''}`}
                  selected={i === presetIndex}
                  disabled={!fits(p)}
                  onPress={() => update({ presetIndex: i })}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.groupRow}>
          <ToggleRow
            icon="lock-closed"
            hue="violet"
            label="Keep it private"
            caption="Hidden from the feed, still counts for you"
            value={setup.isPrivate}
            onValueChange={(on) => update({ isPrivate: on })}
          />
        </View>
      </View>

      {pinStart ? null : startBlock}
    </Screen>
  );
}

/** "ends 11:47 PM" (breaks included), or "counts up" with no limit. */
function dialCaption(totalMinutes: number | null) {
  return totalMinutes ? `ends ${formatTimeOfDay(Date.now() + totalMinutes * 60_000)}` : 'counts up';
}

function pomodoroCaption(
  goal: number | null,
  plan: ReturnType<typeof planSession>,
  preset: { focus: number; rest: number } | null,
  breaksFit: boolean
) {
  if (!breaksFit) return `Needs more than ${BREAK_PRESETS[0].focus} min`;
  if (!preset) return 'Breaks between focus rounds';
  if (goal === null) return `${preset.rest} min break every ${preset.focus} min`;
  if (plan.rounds && plan.breakMinutes > 0) return `${plan.rounds} rounds · ${formatGoal(plan.breakMinutes)} of breaks`;
  return 'No break needed at this length';
}

const styles = StyleSheet.create({
  dialBlock: { alignItems: 'center', gap: Spacing.sm },
  noGrow: { flexGrow: 0 },
  section: { gap: Spacing.sm },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md },
  groupRow: { padding: Spacing.md, gap: Spacing.md },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.md + 32 + Spacing.md },
  breakPresets: { alignItems: 'center', gap: Spacing.sm, paddingLeft: 32 + Spacing.md },
  footer: { gap: Spacing.sm },
});
