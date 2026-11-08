import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { TimelineBar } from '@/components/feed/timeline-bar';
import { Text } from '@/components/ui/text';
import { APP_NAME } from '@/constants/brand';
import { addDays, dayLong, startOfWeek } from '@/features/stats/dates';
import type { StatsSummary } from '@/features/stats/use-stats';
import { formatDuration, formatGoal, formatTotal } from '@/lib/format';
import type { SessionPause } from '@/lib/types';
import type { SessionWithSubject } from '@/providers/active-session-provider';
import { Fonts, Hues, Radius, Spacing, subjectColor, useTheme, withAlpha } from '@/theme';

export type CardDesign = 'session' | 'streak' | 'year';

/** On-screen size; exported at 1080 × 1350 (Instagram's 4:5). */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 450;

export type ShareCardData = {
  session: SessionWithSubject;
  pauses: Pick<SessionPause, 'kind' | 'started_at' | 'ended_at'>[];
  summary: StatsSummary;
  /** Focused seconds per 'YYYY-MM-DD', for the year card. */
  totals: Map<string, number>;
  username: string | null;
};

export type CardRef = ComponentRef<typeof View>;

type Props = {
  design: CardDesign;
  data: ShareCardData;
  /** A photo behind the card (local URI), Strava-style. */
  background?: string | null;
  ref?: Ref<CardRef>;
};

/** One share card. The ref goes to the outer view, which is what gets captured as an image. */
export function ShareCard({ design, data, background, ref }: Props) {
  const { colors } = useTheme();
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {background ? (
        <>
          <Image source={{ uri: background }} style={styles.fill} contentFit="cover" accessibilityIgnoresInvertColors />
          {/* The photo shows clearly up top; the stats sit at the bottom over a dark fade, like Strava. */}
          <LinearGradient
            colors={[withAlpha(colors.background, 0.55), withAlpha(colors.background, 0.05), withAlpha(colors.background, 0.92)]}
            locations={[0, 0.3, 0.8]}
            style={styles.fill}
          />
        </>
      ) : null}
      <View style={styles.top}>
        <View style={styles.brand}>
          <Ionicons name="flame" size={16} color={colors.accent} />
          <Text variant="label" style={{ color: colors.accent }}>
            {APP_NAME}
          </Text>
        </View>
        <Text variant="caption" color="textMuted">
          {dayLong(data.summary.today)}
        </Text>
      </View>
      <View style={[styles.body, background ? styles.bodyBottom : null]}>
        {design === 'session' ? <SessionBody data={data} /> : design === 'streak' ? <StreakBody data={data} /> : <YearBody data={data} />}
      </View>
      {data.username ? (
        <Text variant="label" color="textMuted">
          @{data.username}
        </Text>
      ) : null}
    </View>
  );
}

function SessionBody({ data }: { data: ShareCardData }) {
  const { colors, scheme } = useTheme();
  const { session } = data;
  const focused = session.focused_seconds ?? 0;
  const color = subjectColor(session.subject?.color, scheme, colors.accent);
  const goal = session.goal_minutes;

  return (
    <View style={styles.stack}>
      <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.18) }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text variant="label">{session.subject?.name ?? 'Focus session'}</Text>
      </View>
      <Text style={[styles.hero, { color: colors.text }]}>{formatDuration(focused)}</Text>
      <Text color="textMuted">
        {goal
          ? focused >= goal * 60
            ? `Hit my ${formatGoal(goal)} goal`
            : `${Math.floor((focused / (goal * 60)) * 100)}% of a ${formatGoal(goal)} goal`
          : 'of focus'}
      </Text>
      {session.ended_at ? (
        <TimelineBar startedAt={session.started_at} endedAt={session.ended_at} pauses={data.pauses} color={color} />
      ) : null}
      <StreakLine streak={data.summary.current_streak} />
    </View>
  );
}

function StreakBody({ data }: { data: ShareCardData }) {
  const { colors } = useTheme();
  const { summary } = data;
  const weekSeconds = summary.week.reduce((sum, d) => sum + d.seconds, 0);

  return (
    <View style={[styles.stack, styles.centered]}>
      <Ionicons name="flame" size={64} color={Hues.orange} />
      <Text style={[styles.giant, { color: colors.text }]}>{summary.current_streak}</Text>
      <Text variant="heading" color="textMuted">
        day streak
      </Text>
      <View style={styles.week}>
        {summary.week.map((d) => {
          const done = d.seconds >= summary.streak_min_seconds;
          const future = d.day > summary.today;
          return (
            <View key={d.day} style={styles.weekDay}>
              <View
                style={[
                  styles.weekDot,
                  done
                    ? { backgroundColor: Hues.orange }
                    : { borderColor: future ? colors.border : colors.borderStrong, borderWidth: 2 },
                ]}>
                {done ? <Ionicons name="checkmark" size={14} color={colors.background} /> : null}
              </View>
              <Text variant="caption" color="textMuted">
                {'MTWTFSS'[summary.week.indexOf(d)]}
              </Text>
            </View>
          );
        })}
      </View>
      <Text color="textMuted">{formatDuration(weekSeconds)} studied this week</Text>
    </View>
  );
}

const YEAR_WEEKS = 20;

function YearBody({ data }: { data: ShareCardData }) {
  const { colors } = useTheme();
  const { summary, totals } = data;
  const goal = summary.daily_goal_minutes * 60;
  const start = addDays(startOfWeek(summary.today), -(YEAR_WEEKS - 1) * 7);
  const level = (s: number) => (s <= 0 ? 0 : s < goal * 0.25 ? 1 : s < goal * 0.5 ? 2 : s < goal ? 3 : 4);

  return (
    <View style={styles.stack}>
      <Text style={[styles.hero, { color: colors.text }]}>{formatTotal(summary.total_seconds)}</Text>
      <Text color="textMuted">
        studied over {summary.active_days} {summary.active_days === 1 ? 'day' : 'days'}
      </Text>
      <View style={styles.grid}>
        {Array.from({ length: YEAR_WEEKS }, (_, w) => (
          <View key={w} style={styles.gridCol}>
            {Array.from({ length: 7 }, (_, d) => {
              const day = addDays(start, w * 7 + d);
              const future = day > summary.today;
              return (
                <View
                  key={d}
                  style={[styles.cell, { backgroundColor: future ? 'transparent' : colors.heat[level(totals.get(day) ?? 0)] }]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <StreakLine streak={summary.current_streak} />
    </View>
  );
}

function StreakLine({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <View style={styles.streakLine}>
      <Ionicons name="flame" size={16} color={Hues.orange} />
      <Text variant="bodyStrong" style={{ color: Hues.orange }}>
        {streak}-day streak
      </Text>
    </View>
  );
}

const CELL = 12;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { flex: 1, justifyContent: 'center' },
  bodyBottom: { justifyContent: 'flex-end', paddingBottom: Spacing.md },
  stack: { gap: Spacing.md },
  centered: { alignItems: 'center' },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  hero: { fontFamily: Fonts.extrabold, fontSize: 64, lineHeight: 72, letterSpacing: -2 },
  giant: { fontFamily: Fonts.extrabold, fontSize: 96, lineHeight: 104, letterSpacing: -3 },
  week: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  weekDay: { alignItems: 'center', gap: 4 },
  weekDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', gap: 3 },
  gridCol: { gap: 3 },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  streakLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
