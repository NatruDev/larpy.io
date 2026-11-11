import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DurationDial } from '@/components/timer/duration-dial';
import { QuickLengths } from '@/components/timer/quick-lengths';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { friendlyError, UNIQUE_VIOLATION } from '@/lib/errors';
import { formatGoalShort } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { Radius, Spacing, subjectColor, SubjectColors, useTheme } from '@/theme';

const STEP_COUNT = 3;

const GOAL_PRESETS = [30, 60, 120, 180, 240].map((m) => ({ value: m, label: formatGoalShort(m) }));
/** Within the profiles check (5–1440); 12 h is plenty for a daily goal. */
const MIN_GOAL = 5;
const MAX_GOAL = 12 * 60;
const GOAL_STEP = 5;

const SUGGESTED_SUBJECTS = [
  'Math',
  'Biology',
  'Chemistry',
  'Physics',
  'History',
  'English',
  'Languages',
  'Computer Science',
  'Economics',
  'Art',
];

/** Matches the subjects check (1–40 characters after trimming). */
const MAX_SUBJECT_LENGTH = 40;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Adds a typed subject to the list. Names are unique per user ignoring case (a database index), so a
 * name matching a suggestion picks the suggestion, and one already in the list isn't added twice.
 */
function withSubject(list: string[], raw: string) {
  const typed = raw.trim().slice(0, MAX_SUBJECT_LENGTH).trim();
  if (!typed) return list;
  const name = SUGGESTED_SUBJECTS.find((s) => s.toLowerCase() === typed.toLowerCase()) ?? typed;
  return list.some((s) => s.toLowerCase() === name.toLowerCase()) ? list : [...list, name];
}

/** Color a subject will get: assigned in the order picked, like when they're saved. */
function colorForIndex(index: number) {
  return SubjectColors[index % SubjectColors.length];
}

/** First-run setup, one question per screen: daily goal, then subjects, then name and username. */
export default function OnboardingScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const { colors, scheme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const [step, setStep] = useState(0);
  // Which way the steps move, so the next screen slides in from the matching side.
  const [direction, setDirection] = useState<1 | -1>(1);

  const [goal, setGoal] = useState(60);
  // The dial sweeps for its own changes but jumps for presets (see the Focus screen).
  const [animateDial, setAnimateDial] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLast = step === STEP_COUNT - 1;

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setError(null);
    setStep(next);
  }

  function previous() {
    if (step > 0 && !busy) goTo(step - 1);
  }

  // Android's back button steps back through onboarding before leaving it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0 || busy) return false;
      setDirection(-1);
      setError(null);
      setStep(step - 1);
      return true;
    });
    return () => sub.remove();
  }, [step, busy]);

  function next() {
    if (busy) return;
    if (step === 1) {
      // Don't drop a subject that was typed but not added yet.
      const picked = withSubject(subjects, customSubject);
      setSubjects(picked);
      setCustomSubject('');
      if (picked.length === 0) {
        setError('Pick at least one subject. You can change them later.');
        return;
      }
    }
    if (isLast) {
      finish();
      return;
    }
    goTo(step + 1);
  }

  async function finish() {
    setError(null);
    setUsernameError(null);
    const userId = session?.user.id;
    if (!userId) return;

    if (!USERNAME_PATTERN.test(username)) {
      setUsernameError('Use 3–20 lowercase letters, numbers or underscores.');
      return;
    }

    setBusy(true);
    try {
      // Subjects first, so a failed profile update can be retried without losing them.
      const { data: existing, error: existingError } = await supabase
        .from('subjects')
        .select('name')
        .eq('user_id', userId)
        .is('archived_at', null);
      if (existingError) throw existingError;
      const existingNames = new Set((existing ?? []).map((s) => s.name.toLowerCase()));
      const newSubjects = subjects
        .map((name, i) => ({ name, color: colorForIndex(i) }))
        .filter((s) => !existingNames.has(s.name.toLowerCase()));
      if (newSubjects.length > 0) {
        const { error: subjectError } = await supabase.from('subjects').insert(newSubjects);
        if (subjectError) throw subjectError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username,
          display_name: displayName.trim() || null,
          daily_goal_minutes: goal,
          time_zone: detectTimeZone(),
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (profileError) {
        if (profileError.code === UNIQUE_VIOLATION) {
          setUsernameError('That username is taken. Try another one.');
          return;
        }
        throw profileError;
      }

      // Flips the route guard in the root layout, which moves to the app.
      await refreshProfile();
    } catch (e) {
      setError(friendlyError(e as Error));
    } finally {
      setBusy(false);
    }
  }

  function toggleSubject(name: string) {
    setError(null);
    setSubjects((current) => (current.includes(name) ? current.filter((s) => s !== name) : [...current, name]));
  }

  function addCustomSubject() {
    setError(null);
    setSubjects((current) => withSubject(current, customSubject));
    setCustomSubject('');
  }

  // Suggestions first, then anything typed that isn't one of them.
  const subjectChoices = [...SUGGESTED_SUBJECTS, ...subjects.filter((s) => !SUGGESTED_SUBJECTS.includes(s))];
  const dialSize = Math.min(300, windowWidth - 2 * (Spacing.lg + Spacing.xs));
  const entering = (direction === 1 ? FadeInRight : FadeInLeft).duration(250);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <View style={styles.column}>
          <View style={styles.header}>
            <View
              style={styles.progress}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}
              accessibilityValue={{ min: 1, max: STEP_COUNT, now: step + 1 }}>
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <View
                  key={i}
                  style={[styles.progressSegment, { backgroundColor: i <= step ? colors.accent : colors.border }]}
                />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel and sign out"
              onPress={signOut}
              disabled={busy}
              hitSlop={12}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Remounted per step, so each one starts scrolled to the top. */}
          <ScrollView
            key={step}
            style={styles.fill}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">
            <Animated.View entering={entering} style={styles.body}>
              <Text variant="caption" color="textMuted">
                Step {step + 1} of {STEP_COUNT}
              </Text>

              {step === 0 ? (
                <>
                  <Text variant="title" accessibilityRole="header">
                    Set a daily goal
                  </Text>
                  <Text color="textMuted">
                    How long do you want to study each day? Any study at all keeps your streak going.
                  </Text>
                  <View style={styles.dialBlock}>
                    <DurationDial
                      minutes={goal}
                      onChange={(m) => {
                        setAnimateDial(true);
                        setGoal(m);
                      }}
                      animated={animateDial}
                      min={MIN_GOAL}
                      max={MAX_GOAL}
                      step={GOAL_STEP}
                      color={colors.accent}
                      caption="every day"
                      size={dialSize}
                    />
                    <View style={{ width: dialSize }}>
                      <QuickLengths
                        options={GOAL_PRESETS}
                        value={goal}
                        onChange={(m) => {
                          setAnimateDial(false);
                          setGoal(m);
                        }}
                      />
                    </View>
                  </View>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <Text variant="title" accessibilityRole="header">
                    What are you studying?
                  </Text>
                  <Text color="textMuted">Pick your subjects. Each one gets its own color. You can change them later.</Text>
                  <View style={styles.chips}>
                    {subjectChoices.map((name) => {
                      const index = subjects.indexOf(name);
                      return (
                        <Chip
                          key={name}
                          label={name}
                          selected={index >= 0}
                          dotColor={index >= 0 ? subjectColor(colorForIndex(index), scheme, colors.accent) : undefined}
                          onPress={() => toggleSubject(name)}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.addRow}>
                    <View style={styles.fill}>
                      <TextField
                        label="Add your own"
                        value={customSubject}
                        onChangeText={setCustomSubject}
                        placeholder="e.g. Organic Chemistry"
                        maxLength={MAX_SUBJECT_LENGTH}
                        returnKeyType="done"
                        onSubmitEditing={addCustomSubject}
                      />
                    </View>
                    <IconButton
                      icon="add"
                      variant="secondary"
                      accessibilityLabel="Add subject"
                      onPress={addCustomSubject}
                      disabled={!customSubject.trim()}
                    />
                  </View>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <Text variant="title" accessibilityRole="header">
                    Make your profile
                  </Text>
                  <Text color="textMuted">This is how friends find you and see your progress.</Text>
                  <View style={styles.fields}>
                    <TextField
                      label="Your name"
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="Maya Reyes"
                      maxLength={50}
                      autoComplete="name"
                    />
                    <TextField
                      label="Username"
                      value={username}
                      onChangeText={(t) => {
                        setUsernameError(null);
                        setUsername(t.toLowerCase().replace(/\s/g, ''));
                      }}
                      placeholder="maya_studies"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={20}
                      returnKeyType="go"
                      onSubmitEditing={next}
                      error={usernameError}
                      hint="Letters, numbers and underscores."
                    />
                  </View>
                </>
              ) : null}
            </Animated.View>
          </ScrollView>

          <View style={styles.footer}>
            {error ? (
              <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <View style={styles.buttons}>
              <Button
                label="Previous"
                icon="chevron-back"
                variant="secondary"
                onPress={previous}
                disabled={step === 0 || busy}
                style={styles.previous}
              />
              <Button
                label={busy ? 'Saving…' : isLast ? 'Start studying' : 'Next'}
                onPress={next}
                disabled={busy}
                style={styles.next}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg + Spacing.xs,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  progress: { flex: 1, flexDirection: 'row', gap: Spacing.xs + 2 },
  progressSegment: { flex: 1, height: 4, borderRadius: Radius.pill },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg + Spacing.xs, paddingVertical: Spacing.lg },
  body: { gap: Spacing.md },
  dialBlock: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  fields: { gap: Spacing.lg, marginTop: Spacing.sm },
  footer: { gap: Spacing.sm, paddingHorizontal: Spacing.lg + Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  buttons: { flexDirection: 'row', gap: Spacing.md },
  previous: { flex: 1 },
  next: { flex: 2 },
});
