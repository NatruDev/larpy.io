import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { clockIn, type TimelineItem } from '@/features/home/use-week-timeline';
import { formatDuration } from '@/lib/format';
import { OnSubject, Spacing, subjectColor, useTheme } from '@/theme';

/** Capsule height per minute of session, clamped so short sessions stay tappable and long ones fit. */
const PX_PER_MIN = 1.4;
const MIN_HEIGHT = 64;
const MAX_HEIGHT = 220;
const CAPSULE_WIDTH = 56;
const TIME_COLUMN = 64;
/** Gaps at least this long get a "break" hint between capsules. */
const BREAK_HINT_MIN = 20;

function capsuleHeight(item: TimelineItem) {
  const minutes = (item.endMs - item.startMs) / 60_000;
  return Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, minutes * PX_PER_MIN)));
}

type DayTimelineProps = {
  items: TimelineItem[];
  timeZone: string;
  isToday: boolean;
};

/** One day of sessions as a vertical schedule: a colored capsule per session, height ∝ length. */
export function DayTimeline({ items, timeZone, isToday }: DayTimelineProps) {
  const { colors, scheme } = useTheme();
  const colorOf = (item: TimelineItem) => subjectColor(item.color, scheme, colors.textMuted);
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs);
  const last = sorted[sorted.length - 1];

  if (sorted.length === 0) {
    return (
      <Hint
        icon="sleep"
        text={isToday ? 'Nothing yet today. Ready to start?' : 'No study logged this day.'}
        onPress={isToday ? () => router.navigate('/focus') : undefined}
      />
    );
  }

  return (
    <View accessibilityRole="list">
      {sorted.map((item, i) => {
        const next = sorted[i + 1];
        const gapMin = next ? (next.startMs - item.endMs) / 60_000 : 0;
        return (
          <Fragment key={item.id}>
            <Row item={item} color={colorOf(item)} timeZone={timeZone} />
            {next ? (
              <Connector from={colorOf(item)} to={colorOf(next)} tall={gapMin >= BREAK_HINT_MIN}>
                {gapMin >= BREAK_HINT_MIN ? (
                  <HintText icon="sleep" text={`Break · ${formatDuration(gapMin * 60)}`} />
                ) : null}
              </Connector>
            ) : null}
          </Fragment>
        );
      })}
      {isToday && last && !last.live ? (
        <>
          <Connector from={colorOf(last)} to={colors.border} tall>
            <HintText icon="sleep" text="Session over. What's next?" />
          </Connector>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start another session"
            onPress={() => router.navigate('/focus')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.timeColumn} />
            <View style={[styles.capsule, styles.ghost, { height: MIN_HEIGHT, borderColor: colors.borderStrong }]}>
              <Ionicons name="add" size={24} color={colors.textMuted} />
            </View>
            <Text variant="bodyStrong" color="textMuted" style={styles.ghostLabel}>
              Start another session
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function Row({ item, color, timeZone }: { item: TimelineItem; color: string; timeZone: string }) {
  const { colors } = useTheme();
  const minutes = Math.round(item.focusedSeconds / 60);
  const hitGoal = !!item.goalMinutes && item.focusedSeconds >= item.goalMinutes * 60;
  const range = `${clockIn(item.startMs, timeZone)}–${item.live ? 'now' : clockIn(item.endMs, timeZone)}`;
  const glyph = item.live ? 'radio-button-on' : item.isManual ? 'create' : item.isPomodoro ? 'timer' : 'book';
  const title = item.subjectName ?? 'No subject';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${title}, ${range}, ${formatDuration(item.focusedSeconds)} focused${item.live ? ', in progress' : ''}${hitGoal ? ', goal reached' : ''}`}
      style={styles.row}>
      <Text variant="caption" color="textMuted" style={styles.timeColumn}>
        {clockIn(item.startMs, timeZone)}
      </Text>
      <View style={[styles.capsule, { height: capsuleHeight(item), backgroundColor: color }]}>
        <Ionicons name={glyph} size={22} color={OnSubject} />
      </View>
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text variant="caption" color="textMuted" style={styles.tabular}>
            {range} ({minutes < 1 ? '<1' : minutes} min)
          </Text>
          {item.isPomodoro ? <Ionicons name="repeat" size={13} color={colors.textMuted} accessibilityLabel="Pomodoro" /> : null}
          {item.isPrivate ? <Ionicons name="lock-closed" size={12} color={colors.textMuted} accessibilityLabel="Private" /> : null}
        </View>
        <Text variant="heading" numberOfLines={1}>
          {title}
        </Text>
        {item.caption ? (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {item.caption}
          </Text>
        ) : null}
        {item.live ? (
          <Text variant="label" color="accentText">
            In progress
          </Text>
        ) : item.isManual ? (
          <Text variant="caption" color="textMuted">
            Added by hand
          </Text>
        ) : null}
      </View>
      <View style={[styles.check, { borderColor: color }, hitGoal && { backgroundColor: color }]}>
        {hitGoal ? <Ionicons name="checkmark" size={16} color={OnSubject} /> : null}
      </View>
    </View>
  );
}

/** The line between two capsules, fading from one subject's color to the next. */
function Connector({ from, to, tall, children }: { from: string; to: string; tall: boolean; children?: ReactNode }) {
  return (
    <View style={[styles.connectorRow, { minHeight: tall ? 48 : 12 }]}>
      <View style={styles.timeColumn} />
      <View style={styles.connectorTrack}>
        <LinearGradient colors={[from, to]} style={styles.connector} />
      </View>
      <View style={styles.connectorBody}>{children}</View>
    </View>
  );
}

function HintText({ icon, text }: { icon: 'sleep'; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.hint}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.textMuted} />
      <Text variant="caption" color="textMuted">
        {text}
      </Text>
    </View>
  );
}

function Hint({ icon, text, onPress }: { icon: 'sleep'; text: string; onPress?: () => void }) {
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.emptyHint, pressed && styles.pressed]}>
      <HintText icon={icon} text={text} />
    </Pressable>
  ) : (
    <View style={styles.emptyHint}>
      <HintText icon={icon} text={text} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  pressed: { opacity: 0.6 },
  timeColumn: { width: TIME_COLUMN - Spacing.md, paddingTop: 2, textAlign: 'right', fontVariant: ['tabular-nums'] },
  capsule: { width: CAPSULE_WIDTH, borderRadius: CAPSULE_WIDTH / 2, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 2, borderStyle: 'dashed' },
  ghostLabel: { alignSelf: 'center' },
  body: { flex: 1, gap: 2, paddingTop: Spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  tabular: { fontVariant: ['tabular-nums'] },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    marginTop: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorRow: { flexDirection: 'row', gap: Spacing.md },
  connectorTrack: { width: CAPSULE_WIDTH, alignItems: 'center' },
  connector: { width: 4, flex: 1 },
  connectorBody: { flex: 1, justifyContent: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emptyHint: { minHeight: 44, justifyContent: 'center', paddingVertical: Spacing.lg },
});
