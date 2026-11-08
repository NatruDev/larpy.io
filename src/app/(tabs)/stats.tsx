import { StyleSheet, View } from 'react-native';

import { GoalMeter } from '@/components/stats/goal-meter';
import { RecentSessions } from '@/components/stats/recent-sessions';
import { StatTile } from '@/components/stats/stat-tile';
import { SubjectBreakdown } from '@/components/stats/subject-breakdown';
import { WeekBars } from '@/components/stats/week-bars';
import { YearHeatmap } from '@/components/stats/year-heatmap';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useLiveToday } from '@/features/stats/use-live-today';
import { heatmapStart, useDailyTotals, useStatsSummary } from '@/features/stats/use-stats';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDuration, formatGoal, formatTotal } from '@/lib/format';
import { Spacing } from '@/theme';

export default function StatsScreen() {
  const breakpoint = useBreakpoint();
  const { data: summary } = useStatsSummary();
  const live = useLiveToday(summary);
  const { data: totals } = useDailyTotals(summary ? heatmapStart(summary.today) : null);

  if (!summary) {
    return (
      <Screen title="Stats">
        <Text color="textMuted">Loading your stats…</Text>
      </Screen>
    );
  }

  const goalSeconds = summary.daily_goal_minutes * 60;
  const weekSeconds = live.week.reduce((sum, d) => sum + d.seconds, 0);
  const weekDays = live.week.filter((d) => d.seconds >= live.minSeconds).length;
  const tileWidth = breakpoint === 'phone' ? styles.half : styles.quarter;
  // A running session can make today count before it's saved; match the heatmap and streak.
  const todayJustCounted = summary.today_seconds < live.minSeconds && live.todaySeconds >= live.minSeconds;
  const activeDays = summary.active_days + (todayJustCounted ? 1 : 0);

  // Include a running session in today's heatmap square too.
  const heatTotals = new Map(totals ?? []);
  heatTotals.set(summary.today, live.todaySeconds);

  return (
    <Screen title="Stats">
      <View style={styles.tiles}>
        <StatTile
          label="Today"
          icon="time"
          hue="coral"
          value={formatDuration(live.todaySeconds)}
          detail={`of ${formatGoal(summary.daily_goal_minutes)} goal`}
          style={tileWidth}>
          <GoalMeter value={live.todaySeconds} goal={goalSeconds} height={6} />
        </StatTile>
        <StatTile
          label="Streak"
          icon="flame"
          hue="orange"
          value={`${live.streak} ${live.streak === 1 ? 'day' : 'days'}`}
          detail={`Best: ${Math.max(summary.best_streak, live.streak)} days`}
          style={tileWidth}
        />
        <StatTile
          label="This week"
          icon="calendar"
          hue="blue"
          value={formatDuration(weekSeconds)}
          detail={`${weekDays} of 7 days studied`}
          style={tileWidth}
        />
        <StatTile
          label="All time"
          icon="trophy"
          hue="violet"
          value={formatTotal(summary.total_seconds + (live.todaySeconds - summary.today_seconds))}
          detail={`${activeDays} ${activeDays === 1 ? 'day' : 'days'} studied`}
          style={tileWidth}
        />
      </View>

      <Card style={styles.card}>
        <Text variant="heading">Last 12 months</Text>
        <YearHeatmap
          totals={heatTotals}
          today={summary.today}
          goalSeconds={goalSeconds}
          minSeconds={summary.streak_min_seconds}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">This week</Text>
        <WeekBars week={live.week} today={summary.today} goalSeconds={goalSeconds} />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Time per subject</Text>
        <SubjectBreakdown today={summary.today} />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Recent sessions</Text>
        <RecentSessions />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  half: { flexBasis: '47%', flexGrow: 1 },
  quarter: { flexBasis: '22%', flexGrow: 1 },
  card: { gap: Spacing.md },
});
