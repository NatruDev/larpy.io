import Ionicons from '@expo/vector-icons/Ionicons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Celebration } from '@/components/celebrate/celebration';
import { PhotoStrip } from '@/components/feed/photo-strip';
import { ReminderAsk } from '@/components/reminders/reminder-ask';
import { ShareSheet } from '@/components/share/share-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useCelebration } from '@/features/celebrate/use-celebration';
import type { PickedPhoto } from '@/features/feed/media';
import { createPost, MAX_CAPTION, POST_MIN_SESSION_SECONDS } from '@/features/feed/posts';
import { computeTimer, type TimerState } from '@/features/timer/engine';
import { clockSeconds, phaseLabel, sessionTitle } from '@/features/timer/labels';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useServerNow } from '@/hooks/use-server-now';
import { friendlyError } from '@/lib/errors';
import { formatClock, formatDuration, formatGoal, formatTimeOfDay } from '@/lib/format';
import { setLocalCaption } from '@/features/local/local-store';
import { LOCAL_MODE } from '@/lib/backend';
import { supabase } from '@/lib/supabase';
import { useActiveSession, type SessionWithSubject } from '@/providers/active-session-provider';
import { useAuth } from '@/providers/auth-provider';
import { Fonts, MaxContentWidth, Radius, Spacing, subjectColor, useTheme } from '@/theme';

const KEEP_AWAKE_TAG = 'focus-session';

export default function SessionScreen() {
  const { session, pauses, offsetMs, lastEnded } = useActiveSession();
  const now = useServerNow(offsetMs, !!session);
  const state = session ? computeTimer(session, pauses, now) : null;

  useDocumentTitle(session && state ? sessionTitle(state, session.subject?.name) : null);

  // Keep the screen on while a session runs (where the device allows it).
  const running = !!session;
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [running]);

  if (session && state) return <RunningSession session={session} state={state} offsetMs={offsetMs} />;
  if (lastEnded) return <SessionSummary session={lastEnded} />;
  return <Redirect href="/focus" />;
}

function RunningSession({
  session,
  state,
  offsetMs,
}: {
  session: SessionWithSubject;
  state: TimerState;
  offsetMs: number;
}) {
  const { colors, scheme } = useTheme();
  const breakpoint = useBreakpoint();
  const { pause, resume, end, discard, busy, error } = useActiveSession();
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const onBreak = state.phase === 'break';
  const progress = state.goalSeconds ? Math.min(1, state.focusedSeconds / state.goalSeconds) : null;
  const startedAt = formatTimeOfDay(Date.parse(session.started_at));
  // estimatedEndMs is on the server clock; convert back to this device's clock for display.
  const endsAt = state.estimatedEndMs ? formatTimeOfDay(state.estimatedEndMs - offsetMs) : null;
  const clockSize = breakpoint === 'phone' ? 76 : 112;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: onBreak ? colors.accentSoft : colors.background }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide the timer. The session keeps running."
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.hide}>
          <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
          <Text variant="label" color="textMuted">
            Hide
          </Text>
        </Pressable>
        {session.is_private ? (
          <View style={styles.privateTag}>
            <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
            <Text variant="caption" color="textMuted">
              Private
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.center}>
        <View style={[styles.pill, { backgroundColor: colors.surface }]}>
          <View style={[styles.dot, { backgroundColor: subjectColor(session.subject?.color, scheme, colors.accent) }]} />
          <Text variant="label">{session.subject?.name ?? 'No subject'}</Text>
        </View>

        <Text variant="heading" color={onBreak ? 'accentText' : 'textMuted'}>
          {onBreak ? 'Break. Stretch, drink some water.' : phaseLabel(state)}
        </Text>

        <Text
          accessibilityRole="timer"
          style={[styles.clock, { fontSize: clockSize, lineHeight: clockSize * 1.1, color: colors.text }]}>
          {formatClock(clockSeconds(state))}
        </Text>

        <View style={styles.progressBlock}>
          {progress !== null ? (
            <View style={[styles.track, { backgroundColor: onBreak ? colors.surface : colors.accentSoft }]}>
              <View style={[styles.fillBar, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
            </View>
          ) : null}
          <Text variant="label" color="textMuted" style={styles.centerText}>
            {state.goalSeconds
              ? `${formatDuration(state.focusedSeconds)} of ${formatGoal(state.goalSeconds / 60)} focused`
              : `${formatDuration(state.focusedSeconds)} focused`}
            {state.pausedSeconds > 0 ? `, ${formatDuration(state.pausedSeconds)} paused` : ''}
          </Text>
          <Text variant="caption" color="textMuted" style={styles.centerText}>
            Started {startedAt}
            {endsAt ? `. Ends around ${endsAt}.` : state.phase === 'paused' ? '. The clock stops while paused.' : ''}
          </Text>
        </View>

        {error ? (
          <Text variant="caption" color="danger" style={styles.centerText}>
            {error}
          </Text>
        ) : null}

        {confirmingEnd ? (
          <Card style={styles.confirm}>
            <Text variant="heading">End this session?</Text>
            <Text color="textMuted">
              {state.focusedSeconds < 60
                ? 'This session is under a minute. You can save it anyway or discard it.'
                : `You've focused for ${formatDuration(state.focusedSeconds)}. It will be saved to your history.`}
            </Text>
            <View style={styles.buttons}>
              <Button label="Keep going" variant="secondary" onPress={() => setConfirmingEnd(false)} style={styles.grow} />
              <Button label="End and save" onPress={end} disabled={busy} style={styles.grow} />
            </View>
            {state.focusedSeconds < 60 ? (
              <Button label="Discard it" variant="secondary" icon="trash-outline" onPress={discard} disabled={busy} />
            ) : null}
          </Card>
        ) : (
          <View style={[styles.buttons, styles.controls]}>
            <Button
              label="End"
              variant="secondary"
              icon="stop"
              onPress={() => setConfirmingEnd(true)}
              style={styles.grow}
            />
            {state.phase === 'focus' ? (
              <Button label="Pause" icon="pause" size="lg" onPress={pause} disabled={busy} style={styles.growMore} />
            ) : state.phase === 'paused' ? (
              <Button label="Resume" icon="play" size="lg" onPress={resume} disabled={busy} style={styles.growMore} />
            ) : (
              <Button
                label="Skip break"
                icon="play-skip-forward"
                size="lg"
                onPress={resume}
                disabled={busy}
                style={styles.growMore}
              />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function SessionSummary({ session }: { session: SessionWithSubject }) {
  const { colors } = useTheme();
  const { session: auth } = useAuth();
  const { dismissEnded } = useActiveSession();
  const [note, setNote] = useState(session.caption ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const focused = session.focused_seconds ?? 0;
  // Post is on by default whenever the session can be posted.
  // Local mode has no feed yet; the share card is how a session leaves the device.
  const notPostable = LOCAL_MODE
    ? 'Posting arrives when accounts go live. Use Share it to save your session as an image.'
    : session.is_private
      ? 'Private sessions aren’t posted.'
      : focused < POST_MIN_SESSION_SECONDS
        ? 'Sessions under 5 minutes aren’t posted.'
        : null;
  const [postIt, setPostIt] = useState(!notPostable);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const posting = postIt && !notPostable;
  const celebration = useCelebration(session);
  const [sharing, setSharing] = useState(false);
  const goalSeconds = session.goal_minutes ? session.goal_minutes * 60 : null;
  const goalLine = goalSeconds
    ? focused >= goalSeconds
      ? `You hit your ${formatGoal(session.goal_minutes!)} goal.`
      : `${Math.floor((focused / goalSeconds) * 100)}% of your ${formatGoal(session.goal_minutes!)} goal.`
    : null;

  async function leave(to: '/' | '/focus') {
    const trimmed = note.trim();
    setSaving(true);
    setError(null);
    try {
      if (trimmed !== (session.caption ?? '') && LOCAL_MODE) {
        setLocalCaption(session.id, trimmed || null);
      } else if (trimmed !== (session.caption ?? '')) {
        const { error: saveError } = await supabase.from('sessions').update({ caption: trimmed || null }).eq('id', session.id);
        if (saveError) throw saveError;
      }
      if (posting && auth) {
        await createPost({ userId: auth.user.id, sessionId: session.id, caption: trimmed, photos });
      }
    } catch (e) {
      setError(friendlyError(e as Error));
      setSaving(false);
      return;
    }
    setSaving(false);
    dismissEnded();
    router.replace(to);
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.summaryScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.summaryColumn}>
            <View style={styles.hero}>
              {celebration ? (
                <Celebration data={celebration} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
                  <Text variant="title">Session saved</Text>
                </>
              )}
              <Text style={[styles.clock, { fontSize: 56, lineHeight: 64, color: colors.text }]}>
                {formatDuration(focused)}
              </Text>
              <Text color="textMuted" style={styles.centerText}>
                focused{session.subject ? ` on ${session.subject.name}` : ''}
                {session.paused_seconds > 0 ? `, ${formatDuration(session.paused_seconds)} paused` : ''}.
                {goalLine ? ` ${goalLine}` : ''}
              </Text>
              {celebration ? (
                <Button label="Share it" variant="secondary" icon="share-outline" onPress={() => setSharing(true)} />
              ) : null}
            </View>

            {focused >= 60 ? <ReminderAsk /> : null}

            <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ToggleRow
                icon="people"
                hue="blue"
                label="Post to your feed"
                caption={notPostable ?? 'Followers see how long you focused, with your caption and photos.'}
                value={posting}
                onValueChange={setPostIt}
                disabled={!!notPostable || saving}
              />
            </View>

            <TextField
              label={posting ? 'Caption' : 'Add a note'}
              value={note}
              onChangeText={setNote}
              placeholder="What did you get done?"
              maxLength={MAX_CAPTION}
              multiline
              hint={session.is_private ? 'This session is private. Only you can see the note.' : undefined}
              error={error}
            />
            {posting ? <PhotoStrip photos={photos} onChange={setPhotos} disabled={saving} /> : null}
          </View>
        </ScrollView>

        {/* Pinned, so finishing is always one tap away however long the page gets. */}
        <View style={[styles.summaryFooter, { borderTopColor: colors.border }]}>
          <View style={[styles.buttons, styles.footerButtons]}>
            <Button
              label="Start another"
              variant="secondary"
              onPress={() => leave('/focus')}
              disabled={saving}
              style={styles.grow}
            />
            <Button
              label={saving ? (posting ? 'Posting…' : 'Saving…') : posting ? 'Post and finish' : 'Done'}
              onPress={() => leave('/')}
              disabled={saving}
              style={styles.grow}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      {celebration ? (
        <ShareSheet visible={sharing} onClose={() => setSharing(false)} session={session} summary={celebration.summary} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  hide: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: Spacing.sm },
  privateTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  center: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  clock: { fontFamily: Fonts.bold, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  progressBlock: { alignSelf: 'stretch', gap: Spacing.sm, alignItems: 'center' },
  track: { alignSelf: 'stretch', height: 10, borderRadius: 5, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: 5 },
  centerText: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: Spacing.md, alignSelf: 'stretch' },
  controls: { marginTop: Spacing.lg },
  grow: { flex: 1 },
  growMore: { flex: 2 },
  confirm: { alignSelf: 'stretch', gap: Spacing.md },
  summaryScroll: { flexGrow: 1, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg + Spacing.xs },
  summaryColumn: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, padding: Spacing.md },
  summaryFooter: {
    paddingHorizontal: Spacing.lg + Spacing.xs,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButtons: { width: '100%', maxWidth: 520, alignSelf: 'center' },
});
