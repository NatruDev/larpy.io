import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { weekdayIndex } from '@/features/stats/dates';
import { useLiveToday } from '@/features/stats/use-live-today';
import { useStatsSummary } from '@/features/stats/use-stats';
import { formatDuration, formatGoal } from '@/lib/format';
import { Fonts, Hues, Spacing, useTheme } from '@/theme';

import { GoalMeter } from './goal-meter';

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Streak, today's progress toward the daily goal, and this week's study days. */
export function StreakCard() {
  const { colors } = useTheme();
  const { data: summary } = useStatsSummary();
  const { todaySeconds, streak, studiedToday, week, minSeconds } = useLiveToday(summary);

  const goalSeconds = (summary?.daily_goal_minutes ?? 60) * 60;
  const headline = streak > 0 ? `${streak}-day streak` : 'No streak yet';
  const caption = !summary
    ? 'Loading your progress…'
    : streak === 0
      ? 'Study any amount today to start one.'
      : studiedToday
        ? 'You studied today. Come back tomorrow to keep it going.'
        : 'Study today to keep it going.';

  return (
    <Card style={styles.card}>
      <View style={styles.streakRow}>
        <Ionicons name="flame" size={32} color={streak > 0 ? Hues.orange : colors.textMuted} />
        <View style={styles.streakText}>
          <Text style={styles.headline}>{headline}</Text>
          <Text variant="caption" color="textMuted">
            {caption}
            {summary && summary.best_streak > streak ? ` Best: ${summary.best_streak} days.` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.today}>
        <View style={styles.todayRow}>
          <Text variant="label">Today</Text>
          <Text variant="label" color="textMuted">
            {formatDuration(todaySeconds)} of {formatGoal(goalSeconds / 60)}
          </Text>
        </View>
        <GoalMeter value={todaySeconds} goal={goalSeconds} />
      </View>

      <View style={styles.week} accessibilityLabel="This week">
        {WEEK_LETTERS.map((letter, i) => {
          const entry = week.find((d) => weekdayIndex(d.day) === i);
          const isToday = !!entry && entry.day === summary?.today;
          const isFuture = !!entry && !!summary && entry.day > summary.today;
          const studied = !!entry && entry.seconds >= minSeconds;
          return (
            <View key={i} style={styles.day}>
              <View
                accessibilityLabel={`${letter}: ${studied ? 'studied' : isFuture ? 'upcoming' : 'not studied'}`}
                style={[
                  styles.dayDot,
                  studied
                    ? { backgroundColor: colors.accent }
                    : isFuture
                      ? { borderWidth: 2, borderColor: colors.border }
                      : { backgroundColor: colors.heat[0] },
                  isToday && !studied && { borderWidth: 2, borderColor: colors.accent },
                ]}>
                {studied ? <Ionicons name="checkmark" size={15} color={colors.onAccent} /> : null}
              </View>
              <Text variant="caption" color={isToday ? 'accentText' : 'textMuted'} style={styles.dayLetter}>
                {letter}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.lg },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  streakText: { flex: 1, gap: 2 },
  headline: { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 24 },
  today: { gap: Spacing.sm },
  todayRow: { flexDirection: 'row', justifyContent: 'space-between' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4 },
  dayDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayLetter: { fontFamily: Fonts.bold },
});
